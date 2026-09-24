/**
 * Mainline marker — the official Primogem art itself.
 *
 * The user asked for the actual Genshin crystal rather than an SVG redraw
 * after three vector attempts still read "off": no hand-drawn path matches
 * the real thing, so we ship the texture. Rendered as a plain <img> from an
 * inlined data URI (see primogem-uri.ts) — no glow, no pulse; the earlier
 * drop-shadow glow at 13px was what tired the eye.
 *
 * `active` keeps the composer/sidebar semantics: full colour when the session
 * is mainline, a calm greyscale when not (still the real shape, just muted).
 */
import React from 'react'
import { PRIMOGEM_URI } from './primogem-uri.js'

export function SparkStar({ active, size = 14 }: { active: boolean; size?: number }) {
  return (
    <img
      src={PRIMOGEM_URI}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        display: 'block',
        width: size,
        height: size,
        filter: active ? undefined : 'grayscale(1)',
        opacity: active ? undefined : 0.55,
      }}
    />
  )
}
