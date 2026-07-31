/**
 * ブラウザ自動再生制限の解除と AudioContext 共有。
 * 対局画面での最初のクリック／タップで unlock する。
 */

let sharedCtx: AudioContext | null = null;
let unlocked = false;
const unlockWaiters: Array<() => void> = [];

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

export function getSharedAudioContext(): AudioContext | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  if (!sharedCtx) {
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function whenAudioUnlocked(): Promise<void> {
  if (unlocked) return Promise.resolve();
  return new Promise((resolve) => {
    unlockWaiters.push(resolve);
  });
}

/**
 * ユーザー操作から呼ぶ。AudioContext を resume し、短い無音を再生して SE を解禁する。
 */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  const ctx = getSharedAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // ignore — 次の操作で再試行
    return;
  }

  unlocked = true;
  while (unlockWaiters.length > 0) {
    unlockWaiters.shift()?.();
  }
}

export function attachAudioUnlockListeners(target: EventTarget = document): () => void {
  const handler = () => {
    void unlockAudio();
  };
  const opts: AddEventListenerOptions = { capture: true, once: false };
  target.addEventListener("pointerdown", handler, opts);
  target.addEventListener("keydown", handler, opts);
  target.addEventListener("touchstart", handler, opts);

  return () => {
    target.removeEventListener("pointerdown", handler, opts);
    target.removeEventListener("keydown", handler, opts);
    target.removeEventListener("touchstart", handler, opts);
  };
}
