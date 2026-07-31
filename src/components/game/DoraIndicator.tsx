import { Tile } from "@/components/game/Tile";

type DoraIndicatorProps = {
  doraIndicators: string[];
  wallRemaining: number;
  /** 例: 東1局 */
  kyokuLabel: string;
  honba: number;
  kyotaku: number;
  className?: string;
  /** 1行にまとめた省スペース表示 */
  compact?: boolean;
};

/**
 * ドラ表示牌・残り山・局・本場・供託。
 */
export function DoraIndicator({
  doraIndicators,
  wallRemaining,
  kyokuLabel,
  honba,
  kyotaku,
  className = "",
  compact = false,
}: DoraIndicatorProps) {
  if (compact) {
    return (
      <div
        className={[
          "inline-flex max-w-full flex-row flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md bg-black/45 px-1.5 py-0.5 ring-1 ring-[#d4c4a0]/18",
          className,
        ].join(" ")}
        aria-label="場況"
      >
        <p
          className="text-[0.7rem] font-semibold tracking-[0.12em] text-[#f8f1df]"
          style={{ fontFamily: "var(--font-game-display), serif" }}
        >
          {kyokuLabel}
        </p>
        <p
          className="text-[0.55rem] text-[#d4c4a0]/85"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {honba}本場·供託{kyotaku}
        </p>
        <div className="flex flex-row items-center gap-0.5">
          <span
            className="text-[0.5rem] tracking-wider text-[#d4c4a0]/75"
            style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
          >
            ドラ
          </span>
          {doraIndicators.map((tile, index) => (
            <Tile key={`${tile}-${index}`} tile={tile} size="tiny" />
          ))}
        </div>
        <p
          className="text-[0.55rem] tabular-nums text-[#f8f1df]"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          山{wallRemaining}
        </p>
      </div>
    );
  }

  return (
    <div
      className={[
        "flex flex-col items-center gap-2 rounded-xl bg-black/30 px-3 py-2 ring-1 ring-[#d4c4a0]/20",
        className,
      ].join(" ")}
      aria-label="場況"
    >
      <div className="flex items-baseline gap-3">
        <p
          className="text-lg font-semibold tracking-[0.2em] text-[#f8f1df]"
          style={{ fontFamily: "var(--font-game-display), serif" }}
        >
          {kyokuLabel}
        </p>
        <p
          className="text-xs text-[#d4c4a0]/85"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {honba}本場 · 供託 {kyotaku}
        </p>
      </div>

      <div className="flex flex-row items-end gap-3">
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-[0.65rem] tracking-widest text-[#d4c4a0]/75"
            style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
          >
            ドラ
          </span>
          <div className="flex flex-row gap-[0.15rem]">
            {doraIndicators.map((tile, index) => (
              <Tile key={`${tile}-${index}`} tile={tile} size="small" />
            ))}
          </div>
        </div>

        <div
          className="flex flex-col items-center justify-end rounded-md bg-[#0f241c]/70 px-2.5 py-1.5"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          <span className="text-[0.65rem] tracking-widest text-[#d4c4a0]/75">
            残り
          </span>
          <span className="text-base font-semibold tabular-nums text-[#f8f1df]">
            {wallRemaining}
          </span>
        </div>
      </div>
    </div>
  );
}
