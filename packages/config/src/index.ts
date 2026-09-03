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
