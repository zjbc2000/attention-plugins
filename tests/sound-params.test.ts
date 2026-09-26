/**
 * Regression tests for sound calibration and AudioContext lifecycle planning.
 *
 * Background (bugfix 0.1.2): notification sounds were calibrated too quiet —
 * the chime peaked at gain 0.21 (~-13.6 dBFS) at the default 70% volume and
 * decayed to 0.01 within 0.5 s, so with Bluetooth earbuds users perceived
 * "no notification sound at all". The context was also a never-refreshed
 * singleton with a fire-and-forget resume(), which leaves the first play
 * exposed to cold-start output-stream latency.
 *
 * These tests pin the fixed behaviour as pure contracts:
 * - computeEnvelope(): loudness calibration, attack ramps, perceptual
 *   compensation for low frequencies, volume clamping.
 * - resolveContextAction(): create / reuse / recreate + prime / resume plan.
 * Both run under the node environment (no Web Audio stack required) —
 * sounds.ts itself stays a thin browser shell over these decisions.
 */
import { describe, it, expect } from 'vitest'
import {
  computeEnvelope,
  resolveContextAction,
  SOUND_IDS,
  type SoundId,
} from '../src/client/sound-params'

/** Loudest partial of a sound, i.e. what dominates perceived volume. */
function loudest(sound: SoundId, volume: number): number {
  return Math.max(...computeEnvelope(sound, volume).partials.map(p => p.peak))
}

describe('computeEnvelope: loudness calibration', () => {
  it('keeps every sound ≥ 0.35 peak (~ -9 dBFS) at the default 70% volume', () => {
    for (const sound of SOUND_IDS) {
      expect(loudest(sound, 70), `${sound} at volume 70`).toBeGreaterThanOrEqual(0.35)
    }
  })

  it('keeps every sound ≥ 0.5 peak at 100% volume (system-alert ballpark)', () => {
    for (const sound of SOUND_IDS) {
      expect(loudest(sound, 100), `${sound} at volume 100`).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('regression: the old chime peak (0.21 at 70%) is gone', () => {
    // The original bug: 0.7 × 0.3 = 0.21. Guard against silent re-introduction.
    expect(loudest('chime', 70)).toBeGreaterThan(0.3)
  })

  it('compensates low frequencies: subtle (400 Hz) is the loudest of the three', () => {
    // Equal-loudness: 400 Hz needs more amplitude than 800 Hz to feel equally
    // loud, especially on small earbuds — the old calibration had it backwards
    // (subtle peaked at 0.2, the quietest).
    expect(loudest('subtle', 70)).toBeGreaterThan(loudest('chime', 70))
    expect(loudest('subtle', 70)).toBeGreaterThan(loudest('success', 70))
  })

  it('scales linearly with volume and respects 0 as mute', () => {
    for (const sound of SOUND_IDS) {
      const env0 = computeEnvelope(sound, 0)
      expect(env0.partials.every(p => p.peak === 0), `${sound} muted`).toBe(true)
    }
    const v50 = loudest('chime', 50)
    const v100 = loudest('chime', 100)
    expect(v100).toBeCloseTo(v50 * 2, 5)
  })

  it('clamps out-of-range volumes into [0, 100]', () => {
    expect(loudest('chime', 150)).toBeCloseTo(loudest('chime', 100), 5)
    expect(loudest('chime', -5)).toBe(0)
  })
})

describe('computeEnvelope: envelope shape', () => {
  it('always starts with an attack ramp (no click, higher peaks make it audible)', () => {
    for (const sound of SOUND_IDS) {
      expect(computeEnvelope(sound, 70).attackSeconds).toBeGreaterThanOrEqual(0.008)
    }
  })

  it('keeps partials inside headroom so the louder calibration cannot clip', () => {
    for (const sound of SOUND_IDS) {
      const sum = computeEnvelope(sound, 100).partials
        .filter(p => p.startSeconds === 0)
        .reduce((acc, p) => acc + p.peak, 0)
      expect(sum, `${sound} simultaneous partials`).toBeLessThanOrEqual(0.85)
    }
  })

  it('gives the chime a quiet overtone for presence on small drivers', () => {
    const partials = computeEnvelope('chime', 70).partials
    expect(partials.length).toBeGreaterThanOrEqual(2)
    const [fundamental, overtone] = partials
    expect(overtone.frequency).toBeGreaterThan(fundamental.frequency)
    expect(overtone.peak).toBeLessThan(fundamental.peak)
  })

  it('keeps every partial decay within the sound duration', () => {
    for (const sound of SOUND_IDS) {
      const env = computeEnvelope(sound, 70)
      expect(env.duration).toBeGreaterThan(0)
      for (const p of env.partials) {
        expect(p.startSeconds + p.decaySeconds, `${sound} partial ${p.frequency}Hz`)
          .toBeLessThanOrEqual(env.duration)
      }
    }
  })

  it('keeps subtle the softest in character: slowest attack of the three', () => {
    const attacks = Object.fromEntries(
      SOUND_IDS.map(s => [s, computeEnvelope(s, 70).attackSeconds]),
    ) as Record<SoundId, number>
    expect(attacks.subtle).toBeGreaterThan(attacks.chime)
    expect(attacks.subtle).toBeGreaterThan(attacks.success)
  })
})

describe('resolveContextAction: AudioContext lifecycle plan', () => {
  it('plans create + prime when no context exists yet (cold start)', () => {
    expect(resolveContextAction({ hasContext: false, stale: false, suspended: false })).toEqual({
      action: 'create',
      prime: true,
      resume: false,
    })
  })

  it('plans a plain reuse for a running, fresh context (the steady state)', () => {
    expect(resolveContextAction({ hasContext: true, stale: false, suspended: false })).toEqual({
      action: 'reuse',
      prime: false,
      resume: false,
    })
  })

  it('plans resume for a context suspended by autoplay policy', () => {
    expect(resolveContextAction({ hasContext: true, stale: false, suspended: true })).toEqual({
      action: 'reuse',
      prime: false,
      resume: true,
    })
  })

  it('plans recreate + prime when the output device changed (stale context)', () => {
    // Bluetooth connects/disconnects → the singleton may keep rendering into
    // a dead route. Marking it stale forces a fresh context on the next play.
    expect(resolveContextAction({ hasContext: true, stale: true, suspended: false })).toEqual({
      action: 'recreate',
      prime: true,
      resume: false,
    })
    expect(resolveContextAction({ hasContext: true, stale: true, suspended: true })).toEqual({
      action: 'recreate',
      prime: true,
      resume: false,
    })
  })
})
