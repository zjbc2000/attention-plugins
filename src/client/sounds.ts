/**
 * Web Audio synthesis for built-in notification sounds.
 * All sounds are generated in real-time using OscillatorNode + GainNode,
 * no audio files required.
 *
 * Hardening (bugfix 0.1.2):
 * - Calibrated loudness envelopes with attack ramps (see sound-params.ts).
 * - `resume()` is awaited before rendering instead of fire-and-forget, so
 *   sounds are not scheduled against a frozen currentTime.
 * - Fresh/recreated contexts get an inaudible priming blip plus a short
 *   settle window: Bluetooth output-stream cold-start latency otherwise
 *   swallows (or mangles) the very first notification after page load.
 * - `devicechange` marks the singleton stale; the next play recreates the
 *   context so it cannot keep rendering into a dead route after the user
 *   connects/disconnects Bluetooth.
 *
 * The decision logic lives in sound-params.ts (pure, unit-tested); this file
 * is the browser shell that executes it.
 */
import { computeEnvelope, resolveContextAction, type SoundId, type SoundEnvelope } from './sound-params.js'

export type { SoundId } from './sound-params.js'

/** Play one of the built-in sounds at the specified volume (0-100). */
export function playSound(sound: SoundId, volume: number): void {
  if (sound === 'none') return
  if (volume <= 0) return
  void playSoundAsync(sound, volume)
}

/** Lazy singleton AudioContext. */
let audioContext: AudioContext | undefined

/** Set when an output-device change invalidates the singleton. */
let contextStale = false

/** The `devicechange` listener is installed once, on first use. */
let deviceListenerInstalled = false

async function playSoundAsync(sound: SoundId, volume: number): Promise<void> {
  const ctx = await getReadyContext()
  if (!ctx) return
  renderEnvelope(ctx, computeEnvelope(sound, volume))
}

async function getReadyContext(): Promise<AudioContext | undefined> {
  installDeviceListener()

  const plan = resolveContextAction({
    hasContext: audioContext !== undefined,
    stale: contextStale,
    suspended: audioContext?.state === 'suspended',
  })

  if (plan.action === 'recreate') {
    const old = audioContext
    audioContext = undefined
    contextStale = false
    if (old) old.close().catch(() => {})
  }

  if (audioContext === undefined) {
    try {
      audioContext = new AudioContext()
    } catch (err) {
      console.warn('[attention-plugins] Failed to create AudioContext:', err)
      return undefined
    }
  }
  const ctx = audioContext

  if (plan.resume || ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch (err) {
      console.warn('[attention-plugins] Failed to resume AudioContext:', err)
    }
  }

  if (plan.prime) {
    primeOutput(ctx)
    await sleep(120)
  }

  return ctx
}

/**
 * Open the (re)created context's output stream with a 30 ms inaudible blip
 * so the real notification is not the first render a cold Bluetooth sink
 * has to absorb.
 */
function primeOutput(ctx: AudioContext): void {
  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 20
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.0001, now)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.03)
  } catch {
    // Priming is best-effort; never block the notification on it.
  }
}

/** Render a calibrated envelope: attack ramp + per-partial exponential decay. */
function renderEnvelope(ctx: AudioContext, env: SoundEnvelope): void {
  // Small scheduling offset: keeps the first sample clear of stream-start jitter.
  const t0 = ctx.currentTime + 0.02

  for (const partial of env.partials) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.frequency.value = partial.frequency
    osc.type = 'sine'

    const start = t0 + partial.startSeconds
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.linearRampToValueAtTime(partial.peak, start + env.attackSeconds)
    gain.gain.exponentialRampToValueAtTime(0.01, start + partial.decaySeconds)

    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + partial.decaySeconds + 0.02)
  }
}

function installDeviceListener(): void {
  if (deviceListenerInstalled) return
  deviceListenerInstalled = true
  if (typeof navigator === 'undefined') return
  try {
    navigator.mediaDevices?.addEventListener('devicechange', () => {
      contextStale = true
    })
  } catch {
    // mediaDevices is optional (non-secure contexts); sound still works.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
