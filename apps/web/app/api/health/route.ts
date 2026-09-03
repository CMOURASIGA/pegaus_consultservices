import { buildHealthReport } from '@pegasus/core'
import { logger } from '@pegasus/logging'

export const dynamic = 'force-dynamic'

export async function GET() {
  const report = await buildHealthReport()
  logger.info('health_check', { status: report.status, components: report.components.map(({ name, status }) => ({ name, status })) })
  return Response.json(report, {
    status: report.status === 'unavailable' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
