import { Tile } from "@/components/game/Tile";

type HandProps = {
  tiles: string[];
  tileSize?: "large" | "small";
  interactive?: boolean;
  /** タップ可能な牌（未指定なら interactive 時は全て） */
  enabledTiles?: string[] | null;
  /** 強調表示する牌（牌種）。selectedIndex がある場合はそちらを優先 */
  highlightTiles?: string[] | null;
  /** 選択中の牌インデックス（1タップ目で上に上げる） */
  selectedIndex?: number | null;
  onTileClick?: (tile: string, index: number) => void;
};

/**
 * 自分の手牌表示。
 */
export function Hand({
  tiles,
  tileSize = "large",
  interactive = false,
  enabledTiles = null,
  highlightTiles = null,
  selectedIndex = null,
  onTileClick,
}: HandProps) {
  const enabledSet = enabledTiles ? new Set(enabledTiles) : null;
  const highlightSet = highlightTiles ? new Set(highlightTiles) : null;

  return (
    <div
      className="flex flex-row flex-nowrap items-end justify-center gap-[1px] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="list"
      aria-label="手牌"
    >
      {tiles.map((tile, index) => {
        const enabled =
          interactive &&
          (enabledSet == null || enabledSet.has(tile));
        const selected = selectedIndex === index;
        const highlighted =
          selected || (selectedIndex == null && (highlightSet?.has(tile) ?? false));

        return (
          <div
            key={`${tile}-${index}`}
            role="listitem"
            className={[
              "shrink-0 transition-transform duration-150",
              highlighted ? "-translate-y-2" : "",
              interactive && !enabled ? "opacity-35" : "",
            ].join(" ")}
          >
            <Tile
              tile={tile}
              size={tileSize === "large" ? "large" : "small"}
              onClick={
                enabled && onTileClick
                  ? () => onTileClick(tile, index)
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
