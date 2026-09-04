import { z } from 'zod'

const optionalValue = <T extends z.ZodType>(schema: T) => z.preprocess((value) => value === '' ? undefined : value, schema.optional())

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalValue(z.url().startsWith('https://')),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalValue(z.string().min(20)),
})

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_VERSION: z.string().default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  AI_ROUTER_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(30_000),
  AI_ROUTER_RETRIES_PER_MODEL: z.coerce.number().int().min(0).max(3).default(0),
  AI_ROUTER_FALLBACK_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  AI_ROUTER_FALLBACK_MAX_MODELS: z.coerce.number().int().min(1).max(5).default(1),
  AI_ROUTER_FALLBACK_ALLOW_PAID: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
})

export type PublicConfig = z.infer<typeof publicSchema>
export type ServerConfig = z.infer<typeof serverSchema>

export function readPublicConfig(env: NodeJS.ProcessEnv = process.env): PublicConfig {
  const parsed = publicSchema.safeParse(env)
  if (!parsed.success) throw new Error('Invalid public application configuration')
  return parsed.data
}

export function readServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  if (Object.keys(env).some((key) => key.startsWith('NEXT_PUBLIC_') && key.includes('SERVICE_ROLE'))) {
    throw new Error('A service-role credential must never be public')
  }
  const parsed = serverSchema.safeParse(env)
  if (!parsed.success) throw new Error('Invalid server application configuration')
  const config = parsed.data
  if (config.NODE_ENV === 'production') {
    const publicConfig = readPublicConfig(env)
    if (!publicConfig.NEXT_PUBLIC_SUPABASE_URL || !publicConfig.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('Supabase public configuration is required in production')
    }
  }
  return config
}
