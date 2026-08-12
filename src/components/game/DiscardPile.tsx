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
  /**
   * 1列（または1行）あたりの枚数。実卓どおり既定は 6。
   * 自分・対面は横に6枚→次の段、左右は縦に6枚→隣の列。
   */
  lineLength?: number;
  /**
   * row: 6枚で折り返し下段へ（自分・対面）
   * column: 6枚で折り返し横列へ（左右席）
   */
  flow?: "row" | "column";
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
 * 実卓どおり 6 枚で次の段（または次の列）へ進む。全枚表示が基本。
 */
export function DiscardPile({
  discards,
  tileSize = "small",
  orientation = 0,
  lineLength = 6,
  flow = "row",
  className = "",
}: DiscardPileProps) {
  const [focused, setFocused] = useState<DiscardEntry | null>(null);

  const len = Math.max(1, Math.min(7, Math.floor(lineLength)));
  const valid = discards.filter(isRenderableDiscard);

  if (valid.length === 0) {
    return null;
  }

  const isColumnFlow = flow === "column";

  return (
    <>
      <div
        className={[
          "inline-grid gap-x-[2px] gap-y-[3px] content-start justify-items-center",
          className,
        ].join(" ")}
        style={
          isColumnFlow
            ? {
                gridTemplateRows: `repeat(${len}, max-content)`,
                gridAutoFlow: "column",
              }
            : {
                gridTemplateColumns: `repeat(${len}, max-content)`,
              }
        }
        role="list"
        aria-label="捨て牌"
      >
        {valid.map((entry, index) => (
          <div
            key={`${entry.tile}-${index}`}
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
