import {
  tileAriaLabel,
  tileToAssetPath,
  TILE_BACK_PATH,
} from "@/lib/mahjong/tile-asset";

export type TileSize = "large" | "medium" | "small" | "tiny";

/**
 * 画面上の牌の向き（時計回り・度）。
 * 実際の卓と同様、各席のプレイヤーから見て正立するようにする。
 * - 0: 自分
 * - 90: 上家（左）
 * - 180: 対面
 * - 270: 下家（右）
 */
export type TileOrientation = 0 | 90 | 180 | 270;

type TileProps = {
  tile: string;
  size?: TileSize;
  /** 席に応じた基本向き（卓上と同じ） */
  orientation?: TileOrientation;
  /** リーチ宣言牌など、その席から見て横向き */
  sideways?: boolean;
  /** 牌の裏面（暗槓など） */
  faceDown?: boolean;
  className?: string;
  onClick?: () => void;
};

/** サイズは CSS 変数で上書き可能（短い横画面向け） */
const SIZE_CLASS: Record<TileSize, string> = {
  large: "h-[var(--tile-h-lg,4.25rem)] w-[var(--tile-w-lg,3.05rem)]",
  medium: "h-[var(--tile-h-md,3.15rem)] w-[var(--tile-w-md,2.25rem)]",
  small: "h-[var(--tile-h-sm,2.45rem)] w-[var(--tile-w-sm,1.75rem)]",
  tiny: "h-[var(--tile-h-xs,1.85rem)] w-[var(--tile-w-xs,1.3rem)]",
};

const SIDEWAYS_SHELL: Record<TileSize, string> = {
  large: "h-[var(--tile-w-lg,3.05rem)] w-[var(--tile-h-lg,4.25rem)]",
  medium: "h-[var(--tile-w-md,2.25rem)] w-[var(--tile-h-md,3.15rem)]",
  small: "h-[var(--tile-w-sm,1.75rem)] w-[var(--tile-h-sm,2.45rem)]",
  tiny: "h-[var(--tile-w-xs,1.3rem)] w-[var(--tile-h-xs,1.85rem)]",
};

const ROTATE_CLASS: Record<TileOrientation, string> = {
  0: "",
  90: "rotate-90",
  180: "rotate-180",
  270: "-rotate-90",
};

export function normalizeOrientation(degrees: number): TileOrientation {
  const n = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
  if (n === 90 || n === 180 || n === 270) return n;
  return 0;
}

/**
 * FluffyStuff の牌面は模様のみ → Front.png と合成。
 * 裏面は独自 Back.svg（Export の Back は赤無地だった）。
 */
function TileFace({
  src,
  label,
  faceDown,
}: {
  src: string;
  label: string;
  faceDown: boolean;
}) {
  if (faceDown) {
    return (
      <span className="relative block h-full w-full overflow-hidden rounded-[10%] shadow-[0_1px_2px_rgba(0,0,0,0.45)] ring-1 ring-black/25">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="pointer-events-none h-full w-full object-fill select-none"
          draggable={false}
        />
      </span>
    );
  }

  return (
    <span className="relative block h-full w-full overflow-hidden rounded-[10%] bg-[#fffaf2] shadow-[0_1px_2px_rgba(0,0,0,0.4)] ring-1 ring-black/15">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/tiles/Front.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-fill select-none"
        draggable={false}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        className="pointer-events-none relative z-[1] h-full w-full object-contain select-none"
        draggable={false}
      />
    </span>
  );
}

/**
 * 麻雀牌表示。牌コードは "1m" / "0p" / "7z" 形式。
 * orientation で席ごとの卓上向き、sideways でリーチ横倒しを表現する。
 */
export function Tile({
  tile,
  size = "medium",
  orientation = 0,
  sideways = false,
  faceDown = false,
  className = "",
  onClick,
}: TileProps) {
  const interactive = Boolean(onClick);
  const src = faceDown ? TILE_BACK_PATH : tileToAssetPath(tile);
  const label = faceDown ? "裏" : tileAriaLabel(tile);
  const face = <TileFace src={src} label={label} faceDown={faceDown} />;

  const rot = normalizeOrientation(orientation + (sideways ? 90 : 0));
  const landscape = rot === 90 || rot === 270;
  const needsRotate = rot !== 0;

  const shellClass = [
    "relative shrink-0",
    landscape ? SIDEWAYS_SHELL[size] : SIZE_CLASS[size],
    interactive
      ? "cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0"
      : "cursor-default",
    className,
  ].join(" ");

  const content = needsRotate ? (
    <span
      className={[
        "absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2",
        ROTATE_CLASS[rot],
        SIZE_CLASS[size],
      ].join(" ")}
    >
      {face}
    </span>
  ) : (
    face
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`牌 ${label}`}
        className={shellClass}
      >
        {content}
      </button>
    );
  }

  return (
    <div aria-label={`牌 ${label}`} className={shellClass}>
      {content}
    </div>
  );
}
