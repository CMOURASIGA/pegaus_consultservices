import type { CSSProperties } from 'react'

export type DigitalPresenceState = 'ready' | 'listening' | 'processing' | 'speaking' | 'error' | 'offline'

export function DigitalPresence({ state, compact = false, label }: { state: DigitalPresenceState; compact?: boolean; label: string }) {
  return <div className={`pegasus-presence ${state} ${compact ? 'compact' : ''}`} aria-label={`Pegasus: ${label}`}><span className="presence-glow" aria-hidden="true" /><span className="presence-orbit orbit-one" aria-hidden="true" /><span className="presence-orbit orbit-two" aria-hidden="true" /><span className="presence-orbit orbit-three" aria-hidden="true" /><span className="particle-field" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ '--particle-index': index } as CSSProperties} />)}</span><span className="presence-figure" aria-hidden="true"><i className="figure-wing left" /><i className="figure-wing right" /><i className="figure-head"><b className="figure-face-line left" /><b className="figure-face-line right" /></i><i className="figure-neck" /><i className="figure-shoulders" /><i className="figure-torso"><b /></i></span></div>
}
