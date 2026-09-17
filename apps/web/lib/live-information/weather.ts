import 'server-only'

import type { LiveInformationEvidence } from '@pegasus/core'
import type { LiveInformationPort, LiveInformationResolution } from './types'

const weatherIntent = /\b(?:tempo|clima|previs[aã]o|temperatura|chuva|chover|sol|vento|weather)\b/iu
const locationPatterns = [
  /\b(?:em|para|de|no|na)\s+([\p{L}][\p{L}\s.'-]{1,70}?)(?:\?|,?\s+(?:hoje|amanh[aã]|agora|nesta|nesse|nos próximos|para os próximos)|$)/iu,
  /\b(?:tempo|clima)\s+([\p{L}][\p{L}\s.'-]{1,70})(?:\?|$)/iu,
]

type GeocodingResult = { name: string; latitude: number; longitude: number; country?: string; admin1?: string; timezone?: string }
type ForecastResponse = {
  timezone?: string
  current?: { time?: string; temperature_2m?: number; apparent_temperature?: number; precipitation?: number; weather_code?: number; wind_speed_10m?: number }
  current_units?: Record<string, string>
  daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] }
  daily_units?: Record<string, string>
}

const weatherLabels: Record<number, string> = { 0: 'céu limpo', 1: 'predominantemente limpo', 2: 'parcialmente nublado', 3: 'nublado', 45: 'neblina', 48: 'neblina com geada', 51: 'garoa leve', 53: 'garoa moderada', 55: 'garoa intensa', 61: 'chuva leve', 63: 'chuva moderada', 65: 'chuva forte', 71: 'neve leve', 73: 'neve moderada', 75: 'neve forte', 80: 'pancadas leves', 81: 'pancadas moderadas', 82: 'pancadas fortes', 95: 'trovoadas' }

function extractLocation(query: string) {
  for (const pattern of locationPatterns) {
    const value = query.match(pattern)?.[1]?.trim().replace(/[.!]+$/u, '')
    if (value && !/^(?:hoje|amanh[aã]|agora)$/iu.test(value)) return value
  }
}

async function readJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Pegasus/LiveInformation' }, cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000) })
  if (!response.ok) throw new Error(`LIVE_INFORMATION_HTTP_${response.status}`)
  return response.json() as Promise<T>
}

export class OpenMeteoWeatherProvider implements LiveInformationPort {
  async resolve({ query, signal }: { query: string; locale: string; signal?: AbortSignal }): Promise<LiveInformationResolution> {
    if (!weatherIntent.test(query)) return { status: 'not_applicable' }
    const location = extractLocation(query)
    if (!location) return { status: 'needs_input', message: 'Para consultar a previsão, diga a cidade e, se houver ambiguidade, o estado ou país.' }
    try {
      const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
      geocodeUrl.search = new URLSearchParams({ name: location, count: '1', language: 'pt', format: 'json' }).toString()
      const geocode = await readJson<{ results?: GeocodingResult[] }>(geocodeUrl, signal)
      const place = geocode.results?.[0]
      if (!place) return { status: 'unavailable', message: `Não encontrei uma localidade confiável para “${location}”. Informe cidade, estado ou país com mais detalhes.` }

      const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
      forecastUrl.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m', daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone: 'auto', forecast_days: '3' }).toString()
      const forecast = await readJson<ForecastResponse>(forecastUrl, signal)
      if (!forecast.current?.time || forecast.current.temperature_2m === undefined) throw new Error('LIVE_INFORMATION_INVALID_RESPONSE')
      const retrievedAt = new Date().toISOString()
      const placeName = [place.name, place.admin1, place.country].filter(Boolean).join(', ')
      const currentUnit = forecast.current_units?.temperature_2m ?? '°C'
      const windUnit = forecast.current_units?.wind_speed_10m ?? 'km/h'
      const daily = (forecast.daily?.time ?? []).map((day, index) => `${day}: mín ${forecast.daily?.temperature_2m_min?.[index]}${forecast.daily_units?.temperature_2m_min ?? '°C'}, máx ${forecast.daily?.temperature_2m_max?.[index]}${forecast.daily_units?.temperature_2m_max ?? '°C'}, probabilidade máxima de precipitação ${forecast.daily?.precipitation_probability_max?.[index]}${forecast.daily_units?.precipitation_probability_max ?? '%'}`).join('; ')
      const value = `Local: ${placeName}. Observação atual (${forecast.current.time}, fuso ${forecast.timezone ?? place.timezone ?? 'local'}): ${forecast.current.temperature_2m}${currentUnit}, sensação ${forecast.current.apparent_temperature}${currentUnit}, ${weatherLabels[forecast.current.weather_code ?? -1] ?? `código meteorológico ${forecast.current.weather_code}`}, precipitação ${forecast.current.precipitation ?? 0}${forecast.current_units?.precipitation ?? 'mm'}, vento ${forecast.current.wind_speed_10m ?? 0}${windUnit}. Previsão diária: ${daily}. Fonte: Open-Meteo.`
      const evidence: LiveInformationEvidence = { capability: 'weather', provider: 'open-meteo', sourceName: 'Open-Meteo', sourceUrl: forecastUrl.toString(), observedAt: forecast.current.time, retrievedAt, validUntil: new Date(Date.now() + 30 * 60_000).toISOString(), value, trust: 'untrusted_external', retention: 'ephemeral' }
      return { status: 'available', evidence: [evidence] }
    } catch {
      return { status: 'unavailable', message: 'A fonte de previsão do tempo não respondeu de forma confiável agora. Não vou estimar nem inventar dados; tente novamente em alguns minutos.' }
    }
  }
}
