import 'server-only'

import { CapabilityInputError } from '@pegasus/core'
import type { CapabilityDescriptor, CapabilityProviderPort, LiveInformationEvidence } from '@pegasus/core'

export type WeatherInput = { location: string; date: 'current' | 'tomorrow' | string }

export const weatherCapability: CapabilityDescriptor = {
  id: 'live.weather.current_forecast',
  description: 'Obtém condições meteorológicas atuais ou previsão para uma localidade explícita e um período suportado.',
  category: 'live_information',
  inputSchema: { type: 'object', required: ['location', 'date'], properties: { location: { type: 'string', minLength: 2, maxLength: 100 }, date: { oneOf: [{ enum: ['current', 'tomorrow'] }, { type: 'string', format: 'date' }] } }, additionalProperties: false },
  outputSchema: { type: 'array', minItems: 1, items: { required: ['sourceName', 'sourceUrl', 'observedAt', 'retrievedAt', 'validUntil', 'value', 'trust', 'retention'] } },
  provider: 'open-meteo', freshnessTtlMs: 30 * 60_000, readOnly: true, approval: 'none', audit: { eventPrefix: 'capability.weather' },
}

export function isWeatherInput(value: unknown): value is WeatherInput {
  if (!value || typeof value !== 'object') return false
  const input = value as Record<string, unknown>
  if (typeof input.location !== 'string' || input.location.trim().length < 2 || input.location.length > 100 || typeof input.date !== 'string') return false
  if (input.date === 'current' || input.date === 'tomorrow') return true
  return /^\d{4}-\d{2}-\d{2}$/u.test(input.date) && !Number.isNaN(Date.parse(`${input.date}T00:00:00Z`))
}

export function isWeatherEvidence(output: readonly LiveInformationEvidence[]) {
  return output.length > 0 && output.every((item) => item.capability === weatherCapability.id && item.provider === weatherCapability.provider && item.trust === 'untrusted_external' && item.retention === 'ephemeral' && Boolean(item.sourceName && item.sourceUrl && item.observedAt && item.retrievedAt && item.validUntil && item.value))
}

type GeocodingResult = { name: string; latitude: number; longitude: number; country?: string; admin1?: string; timezone?: string }
type ForecastResponse = { timezone?: string; current?: { time?: string; temperature_2m?: number; apparent_temperature?: number; precipitation?: number; weather_code?: number; wind_speed_10m?: number }; current_units?: Record<string, string>; daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[]; weather_code?: number[] }; daily_units?: Record<string, string> }

const weatherLabels: Record<number, string> = { 0: 'céu limpo', 1: 'predominantemente limpo', 2: 'parcialmente nublado', 3: 'nublado', 45: 'neblina', 48: 'neblina com geada', 51: 'garoa leve', 53: 'garoa moderada', 55: 'garoa intensa', 61: 'chuva leve', 63: 'chuva moderada', 65: 'chuva forte', 71: 'neve leve', 73: 'neve moderada', 75: 'neve forte', 80: 'pancadas leves', 81: 'pancadas moderadas', 82: 'pancadas fortes', 95: 'trovoadas' }

async function readJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Pegasus/CapabilityWeather' }, cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000) })
  if (!response.ok) throw new Error(`LIVE_INFORMATION_HTTP_${response.status}`)
  return response.json() as Promise<T>
}

function normalized(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim() }

export class OpenMeteoWeatherProvider implements CapabilityProviderPort {
  readonly id = 'open-meteo'
  constructor(private readonly now: () => Date = () => new Date()) {}
  async health() { return 'available' as const }

  async execute(rawInput: unknown, { signal }: { correlationId: string; signal?: AbortSignal }): Promise<readonly LiveInformationEvidence[]> {
    if (!isWeatherInput(rawInput)) throw new Error('INVALID_WEATHER_INPUT')
    const input = { location: rawInput.location.trim(), date: rawInput.date }
    const [searchName, ...qualifierParts] = input.location.split(',').map((part) => part.trim()).filter(Boolean)
    const qualifier = normalized(qualifierParts.join(' '))
    const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
    geocodeUrl.search = new URLSearchParams({ name: searchName ?? input.location, count: '5', language: 'pt', format: 'json' }).toString()
    const geocode = await readJson<{ results?: GeocodingResult[] }>(geocodeUrl, signal)
    const results = geocode.results ?? []
    if (!results.length) throw new CapabilityInputError(`Não encontrei uma localidade confiável para “${input.location}”. Informe cidade, estado ou país com mais detalhes.`)
    const exact = results.filter((item) => normalized(item.name) === normalized(searchName ?? input.location))
    if (!input.location.includes(',') && exact.length > 1 && new Set(exact.map((item) => `${item.admin1 ?? ''}:${item.country ?? ''}`)).size > 1) throw new CapabilityInputError(`Encontrei mais de uma localidade chamada “${input.location}”. Informe também o estado ou país.`)
    const qualifiedPlace = qualifier ? exact.find((item) => normalized(`${item.admin1 ?? ''} ${item.country ?? ''}`).includes(qualifier)) : undefined
    if (qualifier && exact.length && !qualifiedPlace) throw new CapabilityInputError(`Não consegui confirmar “${input.location}”. Revise a cidade, estado ou país.`)
    const place = qualifiedPlace ?? exact[0] ?? results[0]!

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
    forecastUrl.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m', daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code', timezone: 'auto', forecast_days: '16' }).toString()
    const forecast = await readJson<ForecastResponse>(forecastUrl, signal)
    const days = forecast.daily?.time ?? []
    const targetDate = input.date === 'current' ? days[0] : input.date === 'tomorrow' ? days[1] : input.date
    const dayIndex = targetDate ? days.indexOf(targetDate) : -1
    if (!forecast.current?.time || forecast.current.temperature_2m === undefined || dayIndex < 0) throw new CapabilityInputError('A data solicitada não está no período de previsão suportado pela fonte. Informe uma data mais próxima.')
    const dayMin = forecast.daily?.temperature_2m_min?.[dayIndex]
    const dayMax = forecast.daily?.temperature_2m_max?.[dayIndex]
    const precipitationProbability = forecast.daily?.precipitation_probability_max?.[dayIndex]
    const dayCode = forecast.daily?.weather_code?.[dayIndex]
    if (![dayMin, dayMax, precipitationProbability, dayCode].every((value) => typeof value === 'number' && Number.isFinite(value))) throw new Error('WEATHER_INVALID_OUTPUT')

    const retrievedAt = this.now().toISOString()
    const validUntil = new Date(this.now().getTime() + (weatherCapability.freshnessTtlMs ?? 0)).toISOString()
    const placeName = [place.name, place.admin1, place.country].filter(Boolean).join(', ')
    const units = forecast.daily_units ?? {}
    const daySummary = `${targetDate}: mín ${dayMin}${units.temperature_2m_min ?? '°C'}, máx ${dayMax}${units.temperature_2m_max ?? '°C'}, probabilidade máxima de precipitação ${precipitationProbability}${units.precipitation_probability_max ?? '%'}, ${weatherLabels[dayCode ?? -1] ?? 'condição não classificada'}`
    const currentSummary = input.date === 'current' ? ` Condição atual em ${forecast.current.time}: ${forecast.current.temperature_2m}${forecast.current_units?.temperature_2m ?? '°C'}, sensação ${forecast.current.apparent_temperature}${forecast.current_units?.temperature_2m ?? '°C'}, ${weatherLabels[forecast.current.weather_code ?? -1] ?? 'condição não classificada'}, precipitação ${forecast.current.precipitation ?? 0}${forecast.current_units?.precipitation ?? 'mm'}, vento ${forecast.current.wind_speed_10m ?? 0}${forecast.current_units?.wind_speed_10m ?? 'km/h'}.` : ''
    return [{ capability: weatherCapability.id, provider: this.id, sourceName: 'Open-Meteo', sourceUrl: forecastUrl.toString(), observedAt: input.date === 'current' ? forecast.current.time : `${targetDate}T12:00:00`, retrievedAt, validUntil, value: `Local: ${placeName}. Previsão: ${daySummary}.${currentSummary} Fuso: ${forecast.timezone ?? place.timezone ?? 'local'}.`, trust: 'untrusted_external', retention: 'ephemeral' }]
  }
}
