/**
 * Self-attention figure for the settings hero — "printed plate" treatment.
 *
 * A near-white plate in BOTH themes, like a figure printed on paper: dark
 * saturated lines on a light plate give the strongest possible contrast with
 * zero glow, so nothing blooms or tires the eye. The active query row carries
 * a faint track; lines use non-scaling strokes whose width never dilates with
 * the panel.
 *
 * The viewBox width tracks the rendered width (ResizeObserver) so aspect ratio
 * stays 1:1 and tokens never distort into ellipses.
 *
 * Purely decorative: weights are synthetic, nothing is inferred from real
 * sessions, and the rotation stops under `prefers-reduced-motion`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

const N = 7 // tokens per side
const TOP = 10
const BOT = 90
const XL = 6
const XR_PAD = 6
const INTERVAL_MS = 1500

/** Palette for the printed plate (dark ink on near-white). */
const INK = {
  plate: '#f7f9fc',
  lineLow: '#1f6fc4',
  lineHigh: '#1c4fa8',
  lineMid: '#6d3fd4',
  ghost: '#b9c4d4',
  ghostActive: '#8fa0b8',
  token: '#8a94a6',
  tokenKey: '#5a6578',
  tokenQuery: '#1f6fc4',
  track: 'rgba(31, 111, 196, 0.10)',
}

function yOf(i: number): number {
  return TOP + (i * (BOT - TOP)) / (N - 1)
}

/**
 * Deterministic weights with the structure real attention heads show: a strong
 * diagonal (self) pull plus a couple of off-diagonal favourites, stable across
 * renders so the picture never flickers between panels.
 */
function weight(q: number, j: number): number {
  const base = ((q * 13 + j * 7) % 17) / 17
  const self = 1 - Math.min(Math.abs(q - j), 3) / 3
  return Math.max(0.06, Math.min(1, 0.18 * base + 0.72 * self * self))
}

interface LineSpec {
  q: number
  j: number
  w: number
}

export function AttentionFigure({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLElement | null>(null)
  const [width, setWidth] = useState(576)
  const [query, setQuery] = useState(0)

  const lines = useMemo<LineSpec[]>(() => {
    const out: LineSpec[] = []
    for (let q = 0; q < N; q++) {
      for (let j = 0; j < N; j++) out.push({ q, j, w: weight(q, j) })
    }
    return out
  }, [])

  const ys = useMemo(() => Array.from({ length: N }, (_, i) => yOf(i)), [])

  // Track the rendered width so the viewBox matches 1:1 (no anisotropic
  // stretching: strokes stay crisp and circles stay circles at any panel size).
  useLayoutEffect(() => {
    const node = wrapRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w && w > 40) setWidth(Math.round(w))
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  // Rotate the active query; a static figure is fine for reduced motion.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => {
      setQuery(prev => (prev + 1) % N)
    }, INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  const ink = (w: number): string =>
    w > 0.8 ? INK.lineHigh : w > 0.55 ? INK.lineMid : INK.lineLow

  return (
    <figure ref={wrapRef} className={className ?? 'attention-fig'} aria-hidden="true">
      <svg
        viewBox={`0 0 ${width} 100`}
        width={width}
        height={100}
        className="attention-fig-svg"
      >
        {/* track behind the active query row */}
        <rect
          className="attention-track"
          x={0}
          y={ys[query] - 4.5}
          width={width}
          height={9}
          rx={4.5}
          fill={INK.track}
        />
        {lines.map(({ q, j, w }, i) => {
          const live = q === query
          return (
            <line
              key={i}
              x1={XL}
              y1={ys[q]}
              x2={width - XR_PAD}
              y2={ys[j]}
              stroke={live ? ink(w) : INK.ghost}
              strokeWidth={live ? (1 + w * 2.2).toFixed(2) : 1}
              strokeOpacity={live ? 1 : w > 0 ? 0.5 : 0.5}
              className={live ? 'attention-ln live' : 'attention-ln'}
            />
          )
        })}
        {ys.map((y, i) => (
          <circle
            key={`l${i}`}
            cx={XL}
            cy={y}
            r={3.2}
            fill={i === query ? INK.tokenQuery : INK.token}
            className={`attention-tok${i === query ? ' q' : ''}`}
          />
        ))}
        {ys.map((y, i) => (
          <circle key={`r${i}`} cx={width - XR_PAD} cy={y} r={2.6} fill={INK.tokenKey} className="attention-tok k" />
        ))}
      </svg>
      <figcaption className="attention-fig-caption">self-attention · layer 1 · head 3</figcaption>
    </figure>
  )
}
