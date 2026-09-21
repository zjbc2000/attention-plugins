/**
 * Web Audio synthesis for built-in notification sounds.
 * All sounds are generated in real-time using OscillatorNode + GainNode,
 * no audio files required.
 */
export type SoundId = 'chime' | 'success' | 'subtle' | 'none';
/** Play one of the built-in sounds at the specified volume (0-100). */
export declare function playSound(sound: SoundId, volume: number): void;
//# sourceMappingURL=sounds.d.ts.map