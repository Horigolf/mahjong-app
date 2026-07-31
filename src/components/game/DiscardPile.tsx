"use client";

import { useState } from "react";
import { Tile, type TileOrientation } from "@/components/game/Tile";

export type DiscardEntry = {
  tile: string;
  isRiichiTile: boolean;
};

type DiscardPileProps = {
  discards: DiscardEntry[];
  tileSize?: "medium" | "small" | "tiny";
  /** 席の向き（自分0 / 上家90 / 対面180 / 下家270） */
  orientation?: TileOrientation;
  /** 1行あたりの枚数（対面・自分は6、左右の狭い列は2〜3） */
  columns?: number;
  /** 表示する最大行数。超えた分は末尾を優先表示 */
  maxRows?: number;
  className?: string;
};

function isRenderableDiscard(
  entry: DiscardEntry | null | undefined,
): entry is DiscardEntry {
  return Boolean(
    entry && typeof entry.tile === "string" && entry.tile.trim().length > 0,
  );
}

/**
 * 捨て牌（河）。
 * 牌の向きは orientation で卓上どおり（各席の正面が正立）にする。
 * リーチ宣言牌はその席から見て横向き。
 */
export function DiscardPile({
  discards,
  tileSize = "small",
  orientation = 0,
  columns = 6,
  maxRows,
  className = "",
}: DiscardPileProps) {
  const [focused, setFocused] = useState<DiscardEntry | null>(null);

  const cols = Math.max(1, Math.min(6, Math.floor(columns)));
  const valid = discards.filter(isRenderableDiscard);
  const visible =
    maxRows != null && maxRows > 0 ? valid.slice(-maxRows * cols) : valid;

  if (visible.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={[
          "inline-grid gap-x-[2px] gap-y-[3px] content-start justify-items-center",
          className,
        ].join(" ")}
        style={{ gridTemplateColumns: `repeat(${cols}, max-content)` }}
        role="list"
        aria-label="捨て牌"
      >
        {visible.map((entry, index) => (
          <div
            key={`${entry.tile}-${valid.length - visible.length + index}`}
            role="listitem"
            className="flex items-center justify-center"
          >
            <Tile
              tile={entry.tile}
              size={tileSize}
              orientation={orientation}
              sideways={entry.isRiichiTile}
              onClick={() => setFocused(entry)}
            />
          </div>
        ))}
      </div>

      {focused ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="捨て牌の拡大表示"
          onClick={() => setFocused(null)}
        >
          <div
            className="flex flex-col items-center gap-3 rounded-2xl border border-[#d4c4a0]/30 bg-[#1a2e26]/95 px-8 py-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              className="text-sm tracking-widest text-[#d4c4a0]/80"
              style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
            >
              捨て牌
              {focused.isRiichiTile ? "（リーチ宣言）" : ""}
            </p>
            {/* 拡大時は読みやすさ優先で正立 */}
            <Tile tile={focused.tile} size="large" orientation={0} />
            <button
              type="button"
              className="mt-1 rounded-full border border-[#d4c4a0]/40 px-4 py-1.5 text-sm text-[#f3ead7] transition hover:bg-white/10"
              onClick={() => setFocused(null)}
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
