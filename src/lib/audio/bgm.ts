import {
  getSharedAudioContext,
  isAudioUnlocked,
  unlockAudio,
  whenAudioUnlocked,
} from "@/lib/audio/audioUnlock";

const BGM_PATH = "/assets/bgm/table-ambient.wav";

let bgmEnabled = true;
let bgmVolume = 0.35;
let bgmPaused = false;
let sourceNode: AudioBufferSourceNode | null = null;
let gainNode: GainNode | null = null;
let buffer: AudioBuffer | null = null;
let started = false;

export function setBgmEnabled(enabled: boolean) {
  bgmEnabled = enabled;
  if (!enabled) {
    stopBgm();
  } else if (isAudioUnlocked() && !bgmPaused) {
    void startBgm();
  }
}

export function isBgmEnabled() {
  return bgmEnabled;
}

export function setBgmVolume(volume: number) {
  bgmVolume = Math.max(0, Math.min(1, volume));
  if (gainNode) {
    gainNode.gain.value = bgmVolume;
  }
}

export function getBgmVolume() {
  return bgmVolume;
}

export function isBgmPaused() {
  return bgmPaused;
}

async function ensureBuffer(): Promise<AudioBuffer | null> {
  if (buffer) return buffer;
  const ctx = getSharedAudioContext();
  if (!ctx) return null;
  try {
    const res = await fetch(BGM_PATH);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    buffer = await ctx.decodeAudioData(arr.slice(0));
    return buffer;
  } catch {
    return null;
  }
}

function stopNodes() {
  try {
    sourceNode?.stop();
  } catch {
    // already stopped
  }
  sourceNode?.disconnect();
  gainNode?.disconnect();
  sourceNode = null;
  gainNode = null;
  started = false;
}

export function stopBgm() {
  stopNodes();
}

export function pauseBgm() {
  bgmPaused = true;
  stopNodes();
}

export async function resumeBgm(): Promise<void> {
  bgmPaused = false;
  await startBgm();
}

export async function startBgm(): Promise<void> {
  if (!bgmEnabled || bgmPaused) return;
  if (!isAudioUnlocked()) {
    await unlockAudio();
    if (!isAudioUnlocked()) {
      await whenAudioUnlocked();
    }
  }
  if (!bgmEnabled || bgmPaused || started) return;

  const ctx = getSharedAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }

  const buf = await ensureBuffer();
  if (!buf || started || !bgmEnabled || bgmPaused) return;

  stopNodes();
  const gain = ctx.createGain();
  gain.gain.value = bgmVolume;
  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.loop = true;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
  sourceNode = source;
  gainNode = gain;
  started = true;
}

export function toggleBgmPause(): Promise<void> {
  if (bgmPaused || !started) {
    return resumeBgm();
  }
  pauseBgm();
  return Promise.resolve();
}
