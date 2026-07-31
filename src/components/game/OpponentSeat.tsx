import {
  DiscardPile,
  type DiscardEntry,
} from "@/components/game/DiscardPile";
import { MeldDisplay, type MeldView } from "@/components/game/MeldDisplay";
import type { TileOrientation } from "@/components/game/Tile";

export type OpponentSeatPlayer = {
  name: string;
  score: number;
  wind: string;
  discards: DiscardEntry[];
  melds: MeldView[];
  isDealer?: boolean;
  isRiichi?: boolean;
  isOffline?: boolean;
};

type OpponentSeatProps = {
  player: OpponentSeatPlayer;
  placement: "top" | "left" | "right";
};

/** 画面配置 → 卓上の牌の向き（その席の人から見て正立） */
const SEAT_ORIENTATION: Record<
  OpponentSeatProps["placement"],
  TileOrientation
> = {
  // 左右は最初逆だったので入れ替え（対面180は正しい）
  right: 270,
  top: 180,
  left: 90,
};

function PlayerBadge({
  player,
  align,
}: {
  player: OpponentSeatPlayer;
  align: "left" | "right" | "center";
}) {
  return (
    <div
      className={[
        "relative z-20 flex w-max max-w-full shrink-0 items-center gap-1 rounded-md bg-[#0f241c] px-1.5 py-0.5 ring-1 ring-[#d4c4a0]/25",
        align === "right" ? "flex-row-reverse" : "",
        align === "center" ? "justify-center self-center" : "",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm px-1 text-[0.65rem] font-bold",
          player.isDealer
            ? "bg-[#c9a227] text-[#1a2e26]"
            : "bg-white/10 text-[#f3ead7]",
        ].join(" ")}
        style={{ fontFamily: "var(--font-game-display), serif" }}
      >
        {player.wind}
      </span>
      <div
        className={[
          "min-w-0 leading-tight",
          align === "right" ? "text-right" : "",
          align === "center" ? "text-center" : "",
        ].join(" ")}
      >
        <p
          className="max-w-[6.5rem] truncate text-[0.6rem] text-[#f3ead7]"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {player.name}
          {player.isRiichi ? " ·リーチ" : ""}
        </p>
        {player.isOffline ? (
          <span className="shrink-0 rounded bg-red-900/80 px-1 py-px text-[0.5rem] font-semibold text-red-200">
            切断中
          </span>
        ) : null}
        <p
          className="text-[0.7rem] font-semibold tabular-nums text-[#f8f1df]"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {player.score.toLocaleString("ja-JP")}
        </p>
      </div>
    </div>
  );
}

/**
 * 他家1人分。
 * 捨て牌・副露の向きは実際の卓／一般的な麻雀アプリと同じ
 *（対面は逆さ、左右は横向き＝その席から見て正立）。
 */
export function OpponentSeat({ player, placement }: OpponentSeatProps) {
  const isSide = placement === "left" || placement === "right";
  const orientation = SEAT_ORIENTATION[placement];
  // 左右は牌が横向きになるので 2 列の縦河にして端の列に収める
  const riverColumns = isSide ? 2 : 6;
  const riverMaxRows = placement === "top" ? 2 : 8;

  const melds =
    player.melds.length > 0 ? (
      <div
        className={[
          "game-side-meld max-h-[2.2rem] w-max max-w-full shrink-0 overflow-hidden",
          isSide ? "max-w-[100%]" : "",
        ].join(" ")}
        style={{ contain: "paint" }}
        aria-label="副露"
      >
        <MeldDisplay
          melds={player.melds}
          tileSize="tiny"
          orientation={orientation}
          showLabels={false}
          className={[
            "gap-0.5",
            isSide ? "flex-nowrap justify-start" : "justify-center",
          ].join(" ")}
        />
      </div>
    ) : null;

  const river = (
    <div
      className={[
        "relative z-0 min-h-0 w-max max-w-full overflow-hidden",
        isSide ? "flex-1" : "",
      ].join(" ")}
      style={{ contain: "paint" }}
    >
      <DiscardPile
        discards={player.discards}
        tileSize="tiny"
        orientation={orientation}
        columns={riverColumns}
        maxRows={riverMaxRows}
      />
    </div>
  );

  if (placement === "top") {
    return (
      <div className="flex h-full min-h-0 w-full max-w-full flex-col items-center justify-center gap-0.5 overflow-hidden">
        <PlayerBadge player={player} align="center" />
        {melds}
        <div className="flex justify-center overflow-hidden">{river}</div>
      </div>
    );
  }

  const alignEnd = placement === "right";

  return (
    <div
      className={[
        "flex h-full min-h-0 w-full max-w-full flex-col gap-1 overflow-hidden py-1",
        alignEnd ? "items-end" : "items-start",
      ].join(" ")}
    >
      <PlayerBadge
        player={player}
        align={placement === "left" ? "left" : "right"}
      />
      {melds}
      {river}
    </div>
  );
}
