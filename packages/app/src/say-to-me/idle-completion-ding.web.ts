/**
 * Softer two-tone chime played when a session goes idle (its turn finishes),
 * ported from Say To Me / T3 Code so Paseo sounds the same. Synthesized into a
 * WAV data URL at runtime, matching the send ding, so no binary asset ships.
 */
const IDLE_COMPLETION_DING = {
  duration: 0.58,
  volume: 0.12,
  type: "sine" as OscillatorType,
  firstDuration: 0.26,
  firstFrequency: 370,
  secondDelay: 0.28,
  secondDuration: 0.3,
  secondFrequency: 554,
};

export const IDLE_COMPLETION_DING_DURATION_MS = Math.round(IDLE_COMPLETION_DING.duration * 1000);

let idleDingContext: AudioContext | null = null;
let idleDingAudio: HTMLAudioElement | null = null;
let idleDingUrl: string | null = null;

function audioContextConstructor() {
  const extendedWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? extendedWindow.webkitAudioContext;
}

export function createIdleCompletionDingWavUrl(): string {
  const sampleRate = 44100;
  const samples = Math.floor(sampleRate * IDLE_COMPLETION_DING.duration);
  const dataBytes = samples * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  let offset = 0;

  const writeString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index));
      offset += 1;
    }
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + dataBytes, true);
  offset += 4;
  writeString("WAVEfmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * 2, true);
  offset += 4;
  view.setUint16(offset, 2, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataBytes, true);
  offset += 4;

  const firstEnd = IDLE_COMPLETION_DING.firstDuration;
  const secondStart = IDLE_COMPLETION_DING.secondDelay;
  const secondEnd = secondStart + IDLE_COMPLETION_DING.secondDuration;

  for (let index = 0; index < samples; index += 1) {
    const time = index / sampleRate;
    const frequency =
      time < firstEnd ? IDLE_COMPLETION_DING.firstFrequency : IDLE_COMPLETION_DING.secondFrequency;
    const toneProgress =
      time < firstEnd
        ? time / IDLE_COMPLETION_DING.firstDuration
        : (time - secondStart) / IDLE_COMPLETION_DING.secondDuration;
    const envelope =
      time <= firstEnd || (time >= secondStart && time <= secondEnd)
        ? Math.sin(Math.PI * Math.max(0, Math.min(1, toneProgress)))
        : 0;
    const sample =
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) *
      envelope *
      IDLE_COMPLETION_DING.volume;
    view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
    offset += 2;
  }

  let binary = "";
  for (const byte of new Uint8Array(view.buffer)) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function prepareIdleDingAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!idleDingUrl) idleDingUrl = createIdleCompletionDingWavUrl();
  if (!idleDingAudio) {
    idleDingAudio = new Audio(idleDingUrl);
    idleDingAudio.preload = "auto";
    idleDingAudio.volume = 1;
    idleDingAudio.load();
  }
  return idleDingAudio;
}

/**
 * Plays the idle completion chime. Unlike the send ding this fires outside a
 * user gesture, so it relies on audio already being unlocked — which the send
 * ding does for any thread the user has typed into.
 */
export async function playIdleCompletionDing({ volumeScale = 0.9 } = {}): Promise<boolean> {
  const audio = prepareIdleDingAudio();
  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volumeScale;
      await audio.play();
      return true;
    } catch {
      // Fall through to Web Audio when element playback is blocked.
    }
  }

  const AudioContext = audioContextConstructor();
  if (!AudioContext) return false;

  if (!idleDingContext || idleDingContext.state === "closed") {
    idleDingContext = new AudioContext();
  }
  const context = idleDingContext;
  if (context.state === "suspended") await context.resume();
  const startedAt = context.currentTime;

  const tones = [
    {
      frequency: IDLE_COMPLETION_DING.firstFrequency,
      duration: IDLE_COMPLETION_DING.firstDuration,
      start: 0,
      volume: IDLE_COMPLETION_DING.volume * volumeScale,
      attack: 0.015,
    },
    {
      frequency: IDLE_COMPLETION_DING.secondFrequency,
      duration: IDLE_COMPLETION_DING.secondDuration,
      start: IDLE_COMPLETION_DING.secondDelay,
      volume: IDLE_COMPLETION_DING.volume * 0.75 * volumeScale,
      attack: 0.015,
    },
  ];

  for (const tone of tones) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const toneStart = startedAt + tone.start;

    oscillator.type = IDLE_COMPLETION_DING.type;
    oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(tone.volume, toneStart + tone.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + tone.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneStart + tone.duration + 0.02);
  }
  return true;
}
