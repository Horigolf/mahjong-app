import { Tile, type TileOrientation } from "@/components/game/Tile";

export type MeldView = {
  type: "pon" | "chi" | "ankan" | "minkan" | "kakan";
  tiles: string[];
};

type MeldDisplayProps = {
  melds: MeldView[];
  tileSize?: "medium" | "small" | "tiny";
  /** 席の向き（自分0 / 上家90 / 対面180 / 下家270） */
  orientation?: TileOrientation;
  /** 種別ラベル（ポン等）。狭い他家エリアでは false 推奨 */
  showLabels?: boolean;
  className?: string;
};

const TYPE_LABEL: Record<MeldView["type"], string> = {
  pon: "ポン",
  chi: "チー",
  ankan: "暗槓",
  minkan: "大明槓",
  kakan: "加槓",
};

/**
 * 副露（ポン・チー・カン）表示。牌向きは卓上どおり orientation に合わせる。
 */
export function MeldDisplay({
  melds,
  tileSize = "small",
  orientation = 0,
  showLabels = true,
  className = "",
}: MeldDisplayProps) {
  if (melds.length === 0) {
    return null;
  }

  return (
    <div
      className={["flex flex-row flex-wrap items-end gap-2", className].join(
        " ",
      )}
      aria-label="副露"
    >
      {melds.map((meld, index) => (
        <div
          key={`${meld.type}-${index}`}
          className="flex flex-col items-center gap-0.5"
          title={TYPE_LABEL[meld.type]}
        >
          {showLabels ? (
            <span
              className="text-[0.55rem] leading-none tracking-wider text-[#d4c4a0]/70"
              style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
            >
              {TYPE_LABEL[meld.type]}
            </span>
          ) : null}
          <div className="flex flex-row flex-nowrap items-end gap-[0.1rem]">
            {meld.tiles.map((tile, tileIndex) => (
              <Tile
                key={`${tile}-${tileIndex}`}
                tile={tile}
                size={tileSize}
                orientation={orientation}
                faceDown={
                  meld.type === "ankan" &&
                  (tileIndex === 0 || tileIndex === 3)
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
