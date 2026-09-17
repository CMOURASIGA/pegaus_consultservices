import Image from 'next/image'
import type { CSSProperties } from 'react'

export type DigitalPresenceState = 'ready' | 'listening' | 'processing' | 'speaking' | 'error' | 'offline'
export type DigitalPresenceAsset = { src: string; alt?: string; width: number; height: number; priority?: boolean }

export function DigitalPresence({ state, compact = false, label, asset }: { state: DigitalPresenceState; compact?: boolean; label: string; asset?: DigitalPresenceAsset }) {
  return <figure className={`pegasus-presence ${state} ${compact ? 'compact' : ''} ${asset ? 'has-official-asset' : 'uses-placeholder'}`} aria-label={`Pegasus: ${label}`} data-presence-state={state}>
    <span className="presence-depth presence-depth-back" aria-hidden="true" />
    <span className="presence-glow" aria-hidden="true" />
    <span className="presence-orbit orbit-one" aria-hidden="true" /><span className="presence-orbit orbit-two" aria-hidden="true" /><span className="presence-orbit orbit-three" aria-hidden="true" />
    <span className="particle-field" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ '--particle-index': index } as CSSProperties} />)}</span>
    <span className="presence-asset-stage" aria-hidden={asset?.alt ? undefined : true}>{asset ? <Image className="presence-official-asset" src={asset.src} alt={asset.alt ?? ''} width={asset.width} height={asset.height} priority={asset.priority} sizes={compact ? '(max-width: 720px) 42vw, 220px' : '(max-width: 720px) 72vw, 520px'} /> : <span className="presence-figure"><i className="figure-wing left" /><i className="figure-wing right" /><i className="figure-head"><b className="figure-face-line left" /><b className="figure-face-line right" /></i><i className="figure-neck" /><i className="figure-shoulders" /><i className="figure-torso"><b /></i></span>}</span>
    <span className="presence-depth presence-depth-front" aria-hidden="true" />
  </figure>
}
