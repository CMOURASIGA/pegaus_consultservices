import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenMeteoWeatherProvider } from './weather'

afterEach(() => vi.unstubAllGlobals())

describe('OpenMeteoWeatherProvider', () => {
  it('ignores requests that do not require live weather', async () => {
    await expect(new OpenMeteoWeatherProvider().resolve({ query: 'Lembre meu projeto', locale: 'pt-BR' })).resolves.toEqual({ status: 'not_applicable' })
  })

  it('asks for a location instead of guessing', async () => {
    await expect(new OpenMeteoWeatherProvider().resolve({ query: 'Como está o tempo hoje?', locale: 'pt-BR' })).resolves.toMatchObject({ status: 'needs_input' })
  })

  it('returns ephemeral evidence with provenance and freshness', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ name: 'Curitiba', admin1: 'Paraná', country: 'Brasil', latitude: -25.4, longitude: -49.2, timezone: 'America/Sao_Paulo' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ timezone: 'America/Sao_Paulo', current: { time: '2026-09-17T09:00', temperature_2m: 18, apparent_temperature: 17, precipitation: 0, weather_code: 2, wind_speed_10m: 9 }, current_units: { temperature_2m: '°C', precipitation: 'mm', wind_speed_10m: 'km/h' }, daily: { time: ['2026-09-17'], temperature_2m_max: [22], temperature_2m_min: [13], precipitation_probability_max: [20] }, daily_units: { temperature_2m_max: '°C', temperature_2m_min: '°C', precipitation_probability_max: '%' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    const result = await new OpenMeteoWeatherProvider().resolve({ query: 'Qual a previsão em Curitiba hoje?', locale: 'pt-BR' })
    expect(result).toMatchObject({ status: 'available', evidence: [{ capability: 'weather', provider: 'open-meteo', sourceName: 'Open-Meteo', observedAt: '2026-09-17T09:00', trust: 'untrusted_external', retention: 'ephemeral' }] })
    expect(JSON.stringify(result)).toContain('Curitiba, Paraná, Brasil')
  })

  it('returns an explicit limitation when the provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private provider detail')))
    const result = await new OpenMeteoWeatherProvider().resolve({ query: 'Previsão em Curitiba', locale: 'pt-BR' })
    expect(result).toMatchObject({ status: 'unavailable' })
    expect(JSON.stringify(result)).not.toContain('private provider detail')
  })
})
