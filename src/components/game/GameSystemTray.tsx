"use client";

import { useState } from "react";

type GameSystemTrayProps = {
  bgmAvailable: boolean;
  unlocked: boolean;
  paused: boolean;
  volume: number;
  onUnlock: () => void;
  onTogglePause: () => void;
  onVolume: (volume: number) => void;
  onAbortHanchan?: () => void;
  aborting?: boolean;
};

/**
 * 対局画面のシステム用 UI 置き場（画面右上）。
 * BGM・対局中断など、卓情報から離した操作を置く。
 */
export function GameSystemTray({
  bgmAvailable,
  unlocked,
  paused,
  volume,
  onUnlock,
  onTogglePause,
  onVolume,
  onAbortHanchan,
  aborting = false,
}: GameSystemTrayProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAbort, setConfirmAbort] = useState(false);

  return (
    <div
      className="pointer-events-none absolute top-[max(0.3rem,env(safe-area-inset-top))] right-[max(2.75rem,calc(env(safe-area-inset-right)+2.4rem))] z-50 flex flex-col items-end gap-1.5"
      aria-label="システム"
    >
      {!unlocked ? (
        <button
          type="button"
          onClick={onUnlock}
          title="タップして音声を有効化"
          className="pointer-events-auto rounded-md bg-[#0f241c]/90 px-2 py-1 text-[0.65rem] text-[#f8f1df] ring-1 ring-[#d4c4a0]/40 backdrop-blur-sm"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          音声ON
        </button>
      ) : null}

      {bgmAvailable ? (
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-md bg-[#0f241c]/85 px-1.5 py-1 ring-1 ring-[#d4c4a0]/30 backdrop-blur-sm">
          <button
            type="button"
            onClick={onTogglePause}
            title={paused ? "BGM再生" : "BGM一時停止"}
            aria-label={paused ? "BGM再生" : "BGM一時停止"}
            className="flex h-7 w-7 items-center justify-center rounded text-[#d4c4a0] hover:text-[#f8f1df]"
          >
            {paused ? (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
              </svg>
            )}
          </button>
          <label className="flex items-center gap-1" title="BGM音量">
            <span className="sr-only">BGM音量</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onVolume(Number(e.target.value))}
              className="h-1 w-16 accent-[#c9a227]"
            />
          </label>
        </div>
      ) : null}

      <div className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => {
            setMenuOpen((v) => !v);
            setConfirmAbort(false);
          }}
          title="メニュー"
          aria-expanded={menuOpen}
          aria-label="メニュー"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0f241c]/85 text-[#d4c4a0]/85 ring-1 ring-[#d4c4a0]/30 backdrop-blur-sm hover:text-[#f8f1df]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
          </svg>
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-8 z-[80] w-44 rounded-lg bg-[#0f241c] p-2 shadow-xl ring-1 ring-[#d4c4a0]/35">
            {!confirmAbort ? (
              <button
                type="button"
                disabled={aborting || !onAbortHanchan}
                onClick={() => setConfirmAbort(true)}
                className="w-full rounded-md px-2 py-2 text-left text-xs font-semibold text-red-300 transition hover:bg-red-950/50 disabled:opacity-50"
                style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
              >
                対局を中断する…
              </button>
            ) : (
              <div className="space-y-2">
                <p
                  className="px-1 text-[0.65rem] leading-snug text-[#d4c4a0]"
                  style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
                >
                  現在の点数で終了します（ウマなし）。よろしいですか？
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={aborting}
                    onClick={() => {
                      setConfirmAbort(false);
                      onAbortHanchan?.();
                    }}
                    className="flex-1 rounded-md bg-red-800 px-2 py-1.5 text-[0.65rem] font-semibold text-white disabled:opacity-60"
                  >
                    {aborting ? "中断中…" : "中断する"}
                  </button>
                  <button
                    type="button"
                    disabled={aborting}
                    onClick={() => setConfirmAbort(false)}
                    className="flex-1 rounded-md bg-white/10 px-2 py-1.5 text-[0.65rem] text-[#f8f1df]"
                  >
                    やめる
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <p
        className="pointer-events-none max-w-[11rem] text-right text-[0.55rem] leading-tight text-[#d4c4a0]/55"
        style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
      >
        SE/BGM: 開発用合成音（差し替え可）
      </p>
    </div>
  );
}
