/**
 * Pure decision layer for notification-sound playback.
 *
 * Split out of sounds.ts so the calibration and AudioContext lifecycle
 * decisions are unit-testable without a Web Audio stack (vitest node env).
 * sounds.ts is the thin browser shell that renders these decisions.
 *
 * Calibration rationale (bugfix 0.1.2):
 * The original synthesis peaked at 0.2–0.3 gain (≈ −13 dBFS at the default
 * 70% volume) with fast exponential decays. Through Bluetooth earbuds this
 * landed 15–20 dB below typical system alerts, so users perceived "no
 * notification sound". These envelopes target −7 to −9 dBFS peaks at 70%
 * volume — the ballpark of OS notification sounds — while keeping each
 * sound's character (bright bell / two-tone rise / soft low tone).
 */

export type SoundId = 'chime' | 'success' | 'subtle' | 'none'

/** All sound ids that have an envelope ('none' is a no-op). */
export const SOUND_IDS = ['chime', 'success', 'subtle'] as const

/** One sine partial of a sound. */
export interface Partial {
  /** Frequency in Hz. */
  frequency: number
  /** Peak gain, already scaled for the requested volume. */
  peak: number
  /** Start offset from the sound's t0, in seconds. */
  startSeconds: number
  /** Exponential decay duration from the partial's start, in seconds. */
  decaySeconds: number
}

/** A full sound envelope: when each partial sounds and how loud. */
export interface SoundEnvelope {
  /** Linear attack ramp applied to every partial (click prevention). */
  attackSeconds: number
  /** The sound's partials. */
  partials: readonly Partial[]
  /** Total sound duration in seconds. */
  duration: number
}

/**
 * Base envelopes before volume scaling.
 *
 * Peaks are the gains at 100% volume (−4.2 to −6.5 dBFS fundamentals). The
 * low-frequency `subtle` gets the highest peak: equal-loudness curves mean
 * 400 Hz needs more amplitude than 800 Hz to feel equally loud, and small
 * earbud drivers reproduce it even less efficiently. `subtle` also gets the
 * slowest attack so it keeps its soft character despite the higher peak.
 */
const BASE_ENVELOPES: Readonly<Record<(typeof SOUND_IDS)[number], SoundEnvelope>> = {
  /** Bright bell: 800 Hz fundamental with a quiet 1200 Hz overtone. */
  chime: {
    attackSeconds: 0.012,
    partials: [
      { frequency: 800, peak: 0.55, startSeconds: 0, decaySeconds: 0.6 },
      { frequency: 1200, peak: 0.2, startSeconds: 0, decaySeconds: 0.3 },
    ],
    duration: 0.62,
  },
  /** Cheerful two-tone rise: C5 → E5. */
  success: {
    attackSeconds: 0.01,
    partials: [
      { frequency: 523.25, peak: 0.5, startSeconds: 0, decaySeconds: 0.35 },
      { frequency: 659.25, peak: 0.55, startSeconds: 0.15, decaySeconds: 0.45 },
    ],
    duration: 0.62,
  },
  /** Soft low tone: 400 Hz, gentlest attack of the three. */
  subtle: {
    attackSeconds: 0.025,
    partials: [
      { frequency: 400, peak: 0.62, startSeconds: 0, decaySeconds: 0.55 },
    ],
    duration: 0.58,
  },
}

/** Clamp a raw volume setting into [0, 100]. */
export function clampVolume(volume: number): number {
  if (Number.isFinite(volume)) {
    return Math.min(100, Math.max(0, volume))
  }
  return 0
}

/** Compute the envelope for one sound at the requested volume (0-100). */
export function computeEnvelope(sound: SoundId, volume: number): SoundEnvelope {
  const base = BASE_ENVELOPES[sound as (typeof SOUND_IDS)[number]] ?? BASE_ENVELOPES.chime
  const scale = clampVolume(volume) / 100
  return {
    attackSeconds: base.attackSeconds,
    duration: base.duration,
    partials: base.partials.map(p => ({ ...p, peak: p.peak * scale })),
  }
}

/** Lifecycle inputs observed by the browser shell. */
export interface ContextPlanInput {
  /** Whether a singleton AudioContext already exists. */
  hasContext: boolean
  /** Whether an output-device change invalidated the existing context. */
  stale: boolean
  /** Whether the existing context is suspended (autoplay policy). */
  suspended: boolean
}

/** What the browser shell should do before rendering one sound. */
export interface ContextPlan {
  action: 'create' | 'reuse' | 'recreate'
  /**
   * Warm the output stream before the real sound: a freshly created context
   * (or one recreated after a device switch) gets an inaudible priming blip
   * plus a short settle window, so Bluetooth cold-start latency does not eat
   * the first notification.
   */
  prime: boolean
  /** Resume a suspended context before rendering. */
  resume: boolean
}

/**
 * Decide how to obtain a usable AudioContext for the next sound.
 *
 * - No context → create one and prime the output stream.
 * - Stale context (output device changed) → close and recreate, then prime;
 *   this is the defensive answer to contexts left bound to a dead route
 *   after Bluetooth connects/disconnects.
 * - Suspended context → reuse but resume first.
 * - Otherwise → plain reuse (no priming cost on the steady-state path).
 */
export function resolveContextAction(input: ContextPlanInput): ContextPlan {
  if (!input.hasContext) {
    return { action: 'create', prime: true, resume: false }
  }
  if (input.stale) {
    return { action: 'recreate', prime: true, resume: false }
  }
  if (input.suspended) {
    return { action: 'reuse', prime: false, resume: true }
  }
  return { action: 'reuse', prime: false, resume: false }
}
