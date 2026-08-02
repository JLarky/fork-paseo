const SEND_DING = {
  duration: 0.16,
  volume: 0.24,
  type: "triangle" as OscillatorType,
  startFrequency: 440,
  endFrequency: 587,
};

let sendDingContext: AudioContext | null = null;
let sendDingAudio: HTMLAudioElement | null = null;
let sendDingUrl: string | null = null;

function audioContextConstructor() {
  const extendedWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? extendedWindow.webkitAudioContext;
}

export function createSendDingWavUrl(): string {
  const sampleRate = 44100;
  const samples = Math.floor(sampleRate * SEND_DING.duration);
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

  for (let index = 0; index < samples; index += 1) {
    const progress = index / samples;
    const envelope = Math.sin(Math.PI * progress) * (1 - progress * 0.45);
    const frequency =
      SEND_DING.startFrequency + (SEND_DING.endFrequency - SEND_DING.startFrequency) * progress;
    const sample =
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) * envelope * SEND_DING.volume;
    view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
    offset += 2;
  }

  let binary = "";
  for (const byte of new Uint8Array(view.buffer)) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function prepareSendDingAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!sendDingUrl) sendDingUrl = createSendDingWavUrl();
  if (!sendDingAudio) {
    sendDingAudio = new Audio(sendDingUrl);
    sendDingAudio.preload = "auto";
    sendDingAudio.volume = 1;
    sendDingAudio.load();
  }
  return sendDingAudio;
}

/** Plays the same immediate send feedback used by Say To Me and T3. */
export async function playSendDing({ volumeScale = 1 } = {}): Promise<boolean> {
  const audio = prepareSendDingAudio();
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

  if (!sendDingContext || sendDingContext.state === "closed") {
    sendDingContext = new AudioContext();
  }
  const context = sendDingContext;
  if (context.state === "suspended") await context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startedAt = context.currentTime;

  oscillator.type = SEND_DING.type;
  oscillator.frequency.setValueAtTime(SEND_DING.startFrequency, startedAt);
  oscillator.frequency.exponentialRampToValueAtTime(SEND_DING.endFrequency, startedAt + 0.1);
  gain.gain.setValueAtTime(0.0001, startedAt);
  gain.gain.exponentialRampToValueAtTime(
    SEND_DING.volume * 0.28 * volumeScale,
    startedAt + 0.01,
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + SEND_DING.duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startedAt);
  oscillator.stop(startedAt + SEND_DING.duration + 0.02);
  return true;
}
