/**
 * Tests for custom (uploaded) notification sounds.
 *
 * Two contracts are pinned here:
 * - custom-audio.ts: the accept/reject pipeline. It runs in the node
 *   environment with plain fake files, which is the point of the module being
 *   DOM-free — a FileReader-based implementation could not be tested this way.
 * - sounds.ts: a `customUrl` takes over playback from the Web Audio synthesis,
 *   with a stubbed global `Audio` (there is no media stack in node).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACCEPTED_AUDIO_TYPES,
  MAX_AUDIO_BYTES,
  formatBytes,
  readAudioFile,
} from '../src/client/custom-audio'
import { playSound } from '../src/client/sounds'

/** Fake `File`: only the members `readAudioFile` requires. */
function audioFile(bytes: Uint8Array, type = 'audio/mpeg', name = 'kick.mp3') {
  return {
    type,
    size: bytes.byteLength,
    name,
    arrayBuffer: async (): Promise<ArrayBuffer> => bytes.slice().buffer as ArrayBuffer,
  }
}

/** The base64 payload of a `data:` URL. */
function payloadOf(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

describe('readAudioFile: accepting uploads', () => {
  it('reads a valid mp3 into a data URL with the original size', async () => {
    // A minimal ID3v2 header, as a real mp3 would start.
    const bytes = new TextEncoder().encode('ID3\x04\x00\x00\x00\x00\x00\x00')

    const result = await readAudioFile(audioFile(bytes, 'audio/mpeg', 'kick.mp3'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.audio.name).toBe('kick.mp3')
    expect(result.audio.dataUrl).toMatch(/^data:audio\/mpeg;base64,/)
    expect(result.audio.bytes).toBe(bytes.byteLength)
    expect(atob(payloadOf(result.audio.dataUrl))).toBe('ID3\x04\x00\x00\x00\x00\x00\x00')
  })

  it('keeps the MIME type exactly as reported by the file', async () => {
    const result = await readAudioFile(audioFile(new Uint8Array([1]), 'audio/ogg', 'pop.ogg'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.audio.dataUrl).toMatch(/^data:audio\/ogg;base64,/)
  })

  it('accepts every MIME type in the whitelist', async () => {
    for (const type of ACCEPTED_AUDIO_TYPES) {
      const result = await readAudioFile(audioFile(new Uint8Array([0, 1, 2]), type, 'clip'))
      expect(result.ok, type).toBe(true)
    }
  })

  it('accepts a file exactly at the size limit (the limit is inclusive)', async () => {
    const result = await readAudioFile(audioFile(new Uint8Array(MAX_AUDIO_BYTES), 'audio/wav'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.audio.bytes).toBe(MAX_AUDIO_BYTES)
  })
})

describe('readAudioFile: rejecting uploads', () => {
  it('rejects an unsupported MIME type before reading', async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(4))

    const result = await readAudioFile({ type: 'text/plain', size: 4, name: 'notes.txt', arrayBuffer })

    expect(result).toEqual({ ok: false, reason: 'type' })
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('rejects a file one byte over the limit', async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(MAX_AUDIO_BYTES + 1))

    const result = await readAudioFile({
      type: 'audio/mpeg',
      size: MAX_AUDIO_BYTES + 1,
      name: 'huge.mp3',
      arrayBuffer,
    })

    expect(result).toEqual({ ok: false, reason: 'size' })
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('reports a failed read instead of throwing', async () => {
    const result = await readAudioFile({
      type: 'audio/mpeg',
      size: 1024,
      name: 'gone.mp3',
      arrayBuffer: async () => {
        throw new Error('file handle revoked')
      },
    })

    expect(result).toEqual({ ok: false, reason: 'read' })
  })
})

describe('readAudioFile: base64 chunking', () => {
  it('encodes a full 512 KB payload without overflowing the call stack', async () => {
    // The regression this guards: applying String.fromCharCode to the whole
    // array at once blows the stack somewhere around 100 KB of arguments.
    const bytes = new Uint8Array(MAX_AUDIO_BYTES)

    const result = await readAudioFile(audioFile(bytes, 'audio/wav'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const payload = payloadOf(result.audio.dataUrl)
    expect(payload).toHaveLength(Math.ceil(MAX_AUDIO_BYTES / 3) * 4)
    expect(payload.startsWith('AAAA')).toBe(true)
    // Round-trip proves the chunk joins produced one valid base64 stream, not
    // 16 separately-padded fragments.
    const decoded = atob(payload)
    expect(decoded).toHaveLength(MAX_AUDIO_BYTES)
    expect(/[^\x00]/.test(decoded)).toBe(false)
  })
})

describe('formatBytes', () => {
  it('formats zero and sub-kilobyte sizes in bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes rounded to whole units', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(412 * 1024)).toBe('412 KB')
  })

  it('formats megabytes with one decimal, dropping a trailing .0', () => {
    expect(formatBytes(1536000)).toBe('1.5 MB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2 MB')
  })

  it('treats negative and non-finite input as empty', () => {
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })
})

/** Minimal HTMLAudioElement stand-in; only the members sounds.ts touches. */
class FakeAudio {
  static instances: FakeAudio[] = []

  readonly srcHistory: string[] = []
  volume = 1
  playCalls = 0
  private srcValue: string
  private listeners: Array<{ type: string; listener: () => void }> = []

  constructor(src: string) {
    this.srcValue = src
    this.srcHistory.push(src)
    FakeAudio.instances.push(this)
  }

  get src(): string {
    return this.srcValue
  }

  set src(value: string) {
    this.srcValue = value
    this.srcHistory.push(value)
  }

  play(): Promise<void> {
    this.playCalls += 1
    return Promise.resolve()
  }

  addEventListener(type: string, listener: () => void, _options?: { once?: boolean }): void {
    this.listeners.push({ type, listener })
  }

  /** Fire a media event (e.g. 'ended') at the listeners sounds.ts registered. */
  emit(type: string): void {
    for (const entry of this.listeners.filter(e => e.type === type)) entry.listener()
  }
}

/** FakeAudio whose play() is rejected, standing in for autoplay blocking. */
class RejectingAudio extends FakeAudio {
  override play(): Promise<void> {
    return Promise.reject(new Error('NotAllowedError: play() blocked'))
  }
}

const CUSTOM_URL = 'data:audio/mpeg;base64,SUQzBA=='

describe('playSound: custom audio playback', () => {
  beforeEach(() => {
    FakeAudio.instances = []
    vi.stubGlobal('Audio', FakeAudio)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('plays the uploaded clip instead of synthesizing a built-in sound', () => {
    playSound('chime', 40, CUSTOM_URL)

    expect(FakeAudio.instances).toHaveLength(1)
    const audio = FakeAudio.instances[0]
    expect(audio.srcHistory[0]).toBe(CUSTOM_URL)
    expect(audio.volume).toBeCloseTo(0.4, 5)
    expect(audio.playCalls).toBe(1)
  })

  it('plays a custom clip even when the built-in sound is none', () => {
    playSound('none', 70, CUSTOM_URL)

    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0].playCalls).toBe(1)
  })

  it('clamps out-of-range volume into [0, 1]', () => {
    playSound('chime', 150, CUSTOM_URL)
    playSound('chime', -20, CUSTOM_URL)

    expect(FakeAudio.instances[0].volume).toBe(1)
    expect(FakeAudio.instances[1].volume).toBe(0)
  })

  it('releases the clip once playback ends', () => {
    playSound('chime', 70, CUSTOM_URL)
    const audio = FakeAudio.instances[0]

    audio.emit('ended')

    expect(audio.src).toBe('')
  })

  it('warns instead of throwing when play() is rejected', async () => {
    vi.stubGlobal('Audio', RejectingAudio)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => playSound('chime', 70, CUSTOM_URL)).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()

    expect(warn).toHaveBeenCalledWith(
      '[attention-plugins] Failed to play custom sound:',
      expect.any(Error),
    )
  })

  it('leaves the built-in path alone when no custom URL is given', () => {
    playSound('none', 70)
    playSound('none', 70, null)

    expect(FakeAudio.instances).toHaveLength(0)
  })
})
