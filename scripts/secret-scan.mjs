import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const files = execFileSync('git', ['ls-files', '-z']).toString('utf8').split('\0').filter(Boolean)
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[A-Za-z0-9_-]{30,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
]

const findings = []
for (const file of files) {
  if (file === 'package-lock.json') continue
  const source = readFileSync(file, 'utf8')
  for (const pattern of patterns) if (pattern.test(source)) findings.push(`${file}: ${pattern.source}`)
  if (file.includes('.env') && /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*\s*=\s*\S+/.test(source)) findings.push(`${file}: public service-role assignment`)
}

if (findings.length > 0) {
  console.error('Potential secrets detected:\n' + findings.join('\n'))
  process.exit(1)
}
console.info(`Secret scan passed for ${files.length} tracked files.`)
