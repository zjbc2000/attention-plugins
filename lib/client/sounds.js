/**
 * Web Audio synthesis for built-in notification sounds.
 * All sounds are generated in real-time using OscillatorNode + GainNode,
 * no audio files required.
 */
/** Play one of the built-in sounds at the specified volume (0-100). */
export function playSound(sound, volume) {
    if (sound === 'none')
        return;
    // Respect browser autoplay policy: AudioContext requires user gesture
    const ctx = getAudioContext();
    if (!ctx)
        return;
    const gain = volume / 100;
    switch (sound) {
        case 'chime':
            playChime(ctx, gain);
            break;
        case 'success':
            playSuccess(ctx, gain);
            break;
        case 'subtle':
            playSubtle(ctx, gain);
            break;
    }
}
/** Lazy singleton AudioContext (created on first play after user interaction). */
let audioContext;
function getAudioContext() {
    if (audioContext === undefined) {
        try {
            audioContext = new AudioContext();
        }
        catch (err) {
            console.warn('[attention-plugins] Failed to create AudioContext:', err);
            return undefined;
        }
    }
    // Resume if suspended by autoplay policy
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(err => {
            console.warn('[attention-plugins] Failed to resume AudioContext:', err);
        });
    }
    return audioContext;
}
/** Chime: bright bell sound at 800Hz, 0.5s decay. */
function playChime(ctx, gain) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.frequency.value = 800;
    osc.type = 'sine';
    gainNode.gain.setValueAtTime(gain * 0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.connect(gainNode).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
}
/** Success: cheerful two-tone melody (C5 → E5), 0.3s + 0.4s. */
function playSuccess(ctx, gain) {
    const now = ctx.currentTime;
    // First note: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.frequency.value = 523.25;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(gain * 0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);
    // Second note: E5 (659.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.frequency.value = 659.25;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(gain * 0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
}
/** Subtle: soft low-frequency tone at 400Hz, 0.4s quick decay. */
function playSubtle(ctx, gain) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.frequency.value = 400;
    osc.type = 'sine';
    gainNode.gain.setValueAtTime(gain * 0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.connect(gainNode).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
}
//# sourceMappingURL=sounds.js.map