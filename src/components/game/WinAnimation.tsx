"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Hand } from "@/components/game/Hand";
import { MeldDisplay } from "@/components/game/MeldDisplay";
import type { GameResultDisplay } from "@/types/game";

const AUTO_DISMISS_MS = 8000;

type WinAnimationProps = {
  result: GameResultDisplay | null;
  seatNames: Record<number, string>;
  onDismiss: () => void;
};

function seatLabel(seat: number, names: Record<number, string>) {
  return names[seat] ?? `席${seat + 1}`;
}

function formatDelta(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function FadeIn({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  return (
    <div
      className={[
        "transition-all duration-500 ease-out",
        show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/**
 * 和了・流局・チョンボの結果オーバーレイ。
 * 数秒後または OK で閉じ、呼び出し側が次局へ進める。
 */
export function WinAnimation({
  result,
  seatNames,
  onDismiss,
}: WinAnimationProps) {
  useEffect(() => {
    if (!result) return;
    const id = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [result, onDismiss]);

  if (!result) return null;

  const title =
    result.type === "tsumo"
      ? "ツモ"
      : result.type === "ron"
        ? "ロン"
        : result.type === "ryuukyoku"
          ? "流局"
          : "チョンボ";

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-[#0a1812]/72 p-3 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="max-h-[min(92vh,40rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-gradient-to-b from-[#f8f1df] to-[#d9c9a4] px-5 py-5 shadow-[0_0_48px_rgba(212,196,160,0.4)] ring-2 ring-[#c9a227]/75">
        <FadeIn>
          <p
            className="text-center text-3xl font-bold tracking-[0.3em] text-[#1a2e26]"
            style={{ fontFamily: "var(--font-game-display), serif" }}
          >
            {title}
          </p>
        </FadeIn>

        {(result.type === "tsumo" || result.type === "ron") && (
          <WinBody result={result} seatNames={seatNames} />
        )}
        {result.type === "ryuukyoku" && (
          <RyuukyokuBody result={result} seatNames={seatNames} />
        )}
        {result.type === "chombo" && (
          <ChomboBody result={result} seatNames={seatNames} />
        )}

        <FadeIn delayMs={280} className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg bg-[#1a2e26] px-8 py-2 text-sm font-semibold tracking-wider text-[#f8f1df] transition hover:bg-[#243d32]"
            style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
          >
            OK
          </button>
        </FadeIn>
      </div>
    </div>
  );
}

function WinBody({
  result,
  seatNames,
}: {
  result: Extract<GameResultDisplay, { type: "tsumo" | "ron" }>;
  seatNames: Record<number, string>;
}) {
  const handTiles = result.hand ?? [];
  const winning = result.winningTile;
  const closed =
    winning && handTiles.includes(winning)
      ? (() => {
          const idx = handTiles.lastIndexOf(winning);
          return handTiles.filter((_, i) => i !== idx);
        })()
      : handTiles;

  return (
    <div className="mt-3 space-y-3">
      <FadeIn delayMs={80}>
        <p
          className="text-center text-sm text-[#3d4f45]"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {seatLabel(result.seat, seatNames)}
          {result.type === "ron" && result.fromSeat != null
            ? ` ← ${seatLabel(result.fromSeat, seatNames)}`
            : ""}
        </p>
      </FadeIn>

      {handTiles.length > 0 && (
        <FadeIn delayMs={120} className="flex flex-col items-center gap-1">
          <div className="flex flex-wrap items-end justify-center gap-2">
            <Hand tiles={closed} tileSize="small" />
            {winning ? (
              <div className="ml-1 border-l border-[#1a2e26]/25 pl-2">
                <Hand tiles={[winning]} tileSize="small" />
              </div>
            ) : null}
          </div>
          {result.melds && result.melds.length > 0 ? (
            <MeldDisplay
              melds={result.melds}
              tileSize="tiny"
              showLabels={false}
            />
          ) : null}
        </FadeIn>
      )}

      <FadeIn delayMs={180}>
        <ul
          className="mx-auto max-w-sm space-y-1 text-sm text-[#1a2e26]"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {result.yaku.map((y) => (
            <li
              key={`${y.name}-${y.han}`}
              className="flex items-baseline justify-between gap-3 border-b border-[#1a2e26]/10 py-0.5"
            >
              <span>{y.name}</span>
              <span className="tabular-nums text-[#5a4630]">
                {y.isYakuman ? `役満×${y.han}` : `${y.han}翻`}
              </span>
            </li>
          ))}
        </ul>
      </FadeIn>

      <FadeIn delayMs={240}>
        <p
          className="text-center text-lg font-semibold tabular-nums text-[#1a2e26]"
          style={{ fontFamily: "var(--font-game-display), serif" }}
        >
          {result.han}翻 {result.fu}符　{result.points.toLocaleString()}点
        </p>
        {result.payments && (
          <ul
            className="mt-2 space-y-0.5 text-center text-xs text-[#3d4f45]"
            style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
          >
            {Object.entries(result.payments).map(([seat, delta]) => (
              <li key={seat}>
                {seatLabel(Number(seat), seatNames)} {formatDelta(delta)}
              </li>
            ))}
          </ul>
        )}
      </FadeIn>
    </div>
  );
}

function RyuukyokuBody({
  result,
  seatNames,
}: {
  result: Extract<GameResultDisplay, { type: "ryuukyoku" }>;
  seatNames: Record<number, string>;
}) {
  return (
    <div className="mt-4 space-y-3">
      <FadeIn delayMs={100}>
        <div
          className="grid grid-cols-2 gap-3 text-sm"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-[#5a4630]">
              聴牌
            </p>
            <ul className="space-y-0.5 text-[#1a2e26]">
              {result.tenpaiSeats.length === 0 ? (
                <li className="text-[#5a4630]/70">なし</li>
              ) : (
                result.tenpaiSeats.map((s) => (
                  <li key={s}>{seatLabel(s, seatNames)}</li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-[#5a4630]">
              不聴
            </p>
            <ul className="space-y-0.5 text-[#1a2e26]">
              {result.notenSeats.length === 0 ? (
                <li className="text-[#5a4630]/70">なし</li>
              ) : (
                result.notenSeats.map((s) => (
                  <li key={s}>{seatLabel(s, seatNames)}</li>
                ))
              )}
            </ul>
          </div>
        </div>
      </FadeIn>
      <FadeIn delayMs={200}>
        <p
          className="text-center text-xs font-semibold tracking-wide text-[#5a4630]"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          ノーテン罰符
        </p>
        <ul
          className="mt-1 space-y-0.5 text-center text-sm text-[#1a2e26]"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {Object.entries(result.scoreDeltas).map(([seat, delta]) => (
            <li key={seat} className="tabular-nums">
              {seatLabel(Number(seat), seatNames)} {formatDelta(delta)}
            </li>
          ))}
        </ul>
      </FadeIn>
    </div>
  );
}

function ChomboBody({
  result,
  seatNames,
}: {
  result: Extract<GameResultDisplay, { type: "chombo" }>;
  seatNames: Record<number, string>;
}) {
  return (
    <div className="mt-4 space-y-3 text-center">
      <FadeIn delayMs={100}>
        <p
          className="text-base font-semibold text-[#1a2e26]"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {seatLabel(result.offenderSeat, seatNames)}
        </p>
        <p
          className="mt-1 text-sm text-[#3d4f45]"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {result.reason || "ルール違反"}
        </p>
      </FadeIn>
      <FadeIn delayMs={180}>
        <p
          className="text-lg font-semibold tabular-nums text-[#1a2e26]"
          style={{ fontFamily: "var(--font-game-display), serif" }}
        >
          罰符 {result.penaltyPoints.toLocaleString()}点
        </p>
        <ul
          className="mt-2 space-y-0.5 text-xs text-[#3d4f45]"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {Object.entries(result.payments).map(([seat, delta]) => (
            <li key={seat} className="tabular-nums">
              {seatLabel(Number(seat), seatNames)} {formatDelta(delta)}
            </li>
          ))}
        </ul>
      </FadeIn>
    </div>
  );
}
