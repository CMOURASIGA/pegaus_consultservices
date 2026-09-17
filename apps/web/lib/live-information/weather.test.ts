import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapabilityInputError } from '@pegasus/core'
import { isWeatherEvidence, isWeatherInput, OpenMeteoWeatherProvider } from './weather'

afterEach(() => vi.unstubAllGlobals())

const forecast = { timezone: 'America/Sao_Paulo', current: { time: '2026-09-17T09:00', temperature_2m: 18, apparent_temperature: 17, precipitation: 0, weather_code: 2, wind_speed_10m: 9 }, current_units: { temperature_2m: '°C', precipitation: 'mm', wind_speed_10m: 'km/h' }, daily: { time: ['2026-09-17', '2026-09-18', '2026-09-19'], temperature_2m_max: [22, 24, 25], temperature_2m_min: [13, 14, 15], precipitation_probability_max: [20, 30, 10], weather_code: [2, 61, 0] }, daily_units: { temperature_2m_max: '°C', temperature_2m_min: '°C', precipitation_probability_max: '%' } }

function mockProvider(results = [{ name: 'Curitiba', admin1: 'Paraná', country: 'Brasil', latitude: -25.4, longitude: -49.2, timezone: 'America/Sao_Paulo' }]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ results }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify(forecast), { status: 200 })))
  return new OpenMeteoWeatherProvider(() => new Date('2026-09-17T12:00:00Z'))
}

describe('Weather capability provider', () => {
  it('validates structured input instead of detecting keywords', () => {
    expect(isWeatherInput({ location: 'Curitiba', date: 'current' })).toBe(true)
    expect(isWeatherInput({ location: 'Curitiba', date: '2026-09-19' })).toBe(true)
    expect(isWeatherInput({ query: 'tempo em Curitiba' })).toBe(false)
  })

  it.each([['current', '2026-09-17'], ['tomorrow', '2026-09-18'], ['2026-09-19', '2026-09-19']])('returns normalized evidence for %s', async (date, expectedDay) => {
    const result = await mockProvider().execute({ location: 'Curitiba, Paraná', date }, { correlationId: 'corr' })
    expect(isWeatherEvidence(result)).toBe(true)
    expect(result[0]).toMatchObject({ capability: 'live.weather.current_forecast', provider: 'open-meteo', sourceName: 'Open-Meteo', retrievedAt: '2026-09-17T12:00:00.000Z', validUntil: '2026-09-17T12:30:00.000Z', trust: 'untrusted_external', retention: 'ephemeral' })
    expect(result[0]?.value).toContain(expectedDay)
  })

  it('rejects invalid and ambiguous locations explicitly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 })))
    await expect(new OpenMeteoWeatherProvider().execute({ location: 'Lugar inexistente', date: 'current' }, { correlationId: 'corr' })).rejects.toBeInstanceOf(CapabilityInputError)
    const ambiguous = [{ name: 'Springfield', admin1: 'Illinois', country: 'Estados Unidos', latitude: 1, longitude: 1, timezone: 'America/Chicago' }, { name: 'Springfield', admin1: 'Massachusetts', country: 'Estados Unidos', latitude: 2, longitude: 2, timezone: 'America/New_York' }]
    await expect(mockProvider(ambiguous).execute({ location: 'Springfield', date: 'current' }, { correlationId: 'corr' })).rejects.toBeInstanceOf(CapabilityInputError)
  })

  it('fails closed when the provider is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private provider detail')))
    await expect(new OpenMeteoWeatherProvider().execute({ location: 'Curitiba', date: 'current' }, { correlationId: 'corr' })).rejects.toThrow()
  })
})
