/**
 * Custom notification sounds: validate an uploaded file, then encode it into a
 * `data:` URL that can be handed straight to an HTMLAudioElement.
 *
 * Deliberately DOM-free — no FileReader and no `File` type — so the whole
 * pipeline is unit-testable in the node environment. The picker only needs the
 * four members declared on the parameter (browsers' real `File` satisfies it),
 * and the accept/reject contract is a discriminated union so the settings UI
 * only has to switch on `reason`.
 */
import type { StoredAudio } from '../settings.js'

/** Hard cap for one uploaded sound: localStorage is ~5 MB per origin. */
export const MAX_AUDIO_BYTES: number = 512 * 1024

/**
 * MIME types the picker accepts. mp3 and wav are reported inconsistently across
 * browsers, so every common spelling is listed.
 *
 * Typed as plain `readonly string[]` on purpose: callers pass a runtime
 * `file.type` (a `string`) to `.includes()`, which a literal tuple type would
 * reject.
 */
export const ACCEPTED_AUDIO_TYPES: readonly string[] = [
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
]

/** Why an upload was refused: unsupported MIME, too large, or unreadable. */
export type AudioRejectReason = 'type' | 'size' | 'read'

/** Outcome of reading a picked file; `audio` mirrors `StoredAudio`. */
export type AudioPickResult =
  | { ok: true; audio: StoredAudio }
  | { ok: false; reason: AudioRejectReason }

/**
 * Chunk size for base64 conversion. 32 KiB keeps every
 * `String.fromCharCode.apply` call far below the engine's argument limit: a
 * single spread of a 512 KiB array overflows the call stack.
 */
const BASE64_CHUNK = 0x8000

/**
 * Validate MIME type and size, then read the file into `data:audio/...;base64`.
 *
 * Checks run cheapest-first (`type`, then `size`) so oversized-but-valid files
 * never get read into memory. Any failure while reading — a revoked file handle,
 * an out-of-memory extension, a broken `btoa` input — is reported as `'read'`
 * rather than thrown, because the UI only renders a reason.
 */
export async function readAudioFile(file: {
  type: string
  size: number
  name: string
  arrayBuffer(): Promise<ArrayBuffer>
}): Promise<AudioPickResult> {
  if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
    return { ok: false, reason: 'type' }
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, reason: 'size' }
  }

  try {
    const buffer = await file.arrayBuffer()
    return {
      ok: true,
      audio: {
        name: file.name,
        dataUrl: `data:${file.type};base64,${arrayBufferToBase64(buffer)}`,
        // What was actually encoded, not what the picker claimed: a truncated
        // read must not be reported as the original size.
        bytes: buffer.byteLength,
      },
    }
  } catch {
    return { ok: false, reason: 'read' }
  }
}

/** Human-readable byte count, e.g. `'412 KB'`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  // One decimal keeps `'1.5 MB'`; whole megabytes collapse to `'2 MB'`.
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`
}

/** Base64-encode binary data in bounded chunks (see `BASE64_CHUNK`). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK)
    parts.push(String.fromCharCode.apply(null, chunk as unknown as number[]))
  }
  return btoa(parts.join(''))
}
