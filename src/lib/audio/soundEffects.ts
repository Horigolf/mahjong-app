import {
  getSharedAudioContext,
  isAudioUnlocked,
  unlockAudio,
  whenAudioUnlocked,
} from "@/lib/audio/audioUnlock";

export type SeId =
  | "discard"
  | "pon"
  | "chi"
  | "kan"
  | "riichi"
  | "tsumo"
  | "ron"
  | "ryuukyoku";

const SE_PATHS: Record<SeId, string> = {
  discard: "/assets/sounds/discard.wav",
  pon: "/assets/sounds/pon.wav",
  chi: "/assets/sounds/chi.wav",
  kan: "/assets/sounds/kan.wav",
  riichi: "/assets/sounds/riichi.wav",
  tsumo: "/assets/sounds/tsumo.wav",
  ron: "/assets/sounds/ron.wav",
  ryuukyoku: "/assets/sounds/ryuukyoku.wav",
};

const bufferCache = new Map<string, AudioBuffer>();
let seEnabled = true;
let seVolume = 0.7;

export function setSeEnabled(enabled: boolean) {
  seEnabled = enabled;
}

export function isSeEnabled() {
  return seEnabled;
}

export function setSeVolume(volume: number) {
  seVolume = Math.max(0, Math.min(1, volume));
}

export function getSeVolume() {
  return seVolume;
}

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(url);
  if (cached) return cached;
  const ctx = getSharedAudioContext();
  if (!ctx) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr.slice(0));
    bufferCache.set(url, buf);
    return buf;
  } catch {
    return null;
  }
}

/** よく使う SE を先読み（失敗しても無視） */
export function preloadSoundEffects() {
  void Promise.all(Object.values(SE_PATHS).map((p) => loadBuffer(p)));
}

export async function playSe(id: SeId): Promise<void> {
  if (!seEnabled) return;
  if (!isAudioUnlocked()) {
    await unlockAudio();
    if (!isAudioUnlocked()) {
      await whenAudioUnlocked();
    }
  }
  if (!seEnabled) return;

  const ctx = getSharedAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }

  const buffer = await loadBuffer(SE_PATHS[id]);
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = seVolume;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
}
