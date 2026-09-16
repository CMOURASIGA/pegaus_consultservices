import 'server-only'

import { DeviceGateway, DeviceGatewayError, WebCryptoAgentSignatureVerifier, type AgentRequestProof } from '@pegasus/core'
import { logger } from '@pegasus/logging'
import { NextResponse } from 'next/server'
import { SupabaseDeviceGatewayRepository } from './supabase-repository'

export const createDeviceGateway = () => new DeviceGateway(new SupabaseDeviceGatewayRepository(), new WebCryptoAgentSignatureVerifier())

export function proofFromHeaders(headers: Headers): AgentRequestProof {
  const value = (name: string) => headers.get(name)?.trim() ?? ''
  const proof = {
    deviceId: value('x-pegasus-device-id'), keyId: value('x-pegasus-key-id'),
    timestamp: value('x-pegasus-timestamp'), nonce: value('x-pegasus-nonce'),
    bodyDigest: value('x-pegasus-body-digest'), signature: value('x-pegasus-signature'),
  }
  if (Object.values(proof).some(item => !item)) throw new DeviceGatewayError('AUTH_INVALID', 401)
  return proof
}

export function gatewayError(error: unknown) {
  if (error instanceof DeviceGatewayError) {
    logger.warn('device.gateway.rejected', { errorCode: error.code, status: error.status })
    return NextResponse.json({ error: { code: error.code, message: 'Device request rejected.' } }, { status: error.status })
  }
  logger.error('device.gateway.failed', { errorCode: error instanceof Error ? error.name : 'unknown' })
  return NextResponse.json({ error: { code: 'DEVICE_GATEWAY_UNAVAILABLE', message: 'Device Gateway temporarily unavailable.' } }, { status: 503 })
}
