/**
 * 牌コード ("1m" / "0p" / "7z") から牌画像パスへ変換。
 * 素材: FluffyStuff/riichi-mahjong-tiles Export/Regular（CC0）
 * ※牌面は模様のみ → Tile 側で Front.png と合成。
 * ※ Back / Haku は元 Export が壊れていたため独自 SVG を使用。
 */

const HONOR_FILE: Record<string, { file: string; ext: "png" | "svg" }> = {
  "1z": { file: "Ton", ext: "png" },
  "2z": { file: "Nan", ext: "png" },
  "3z": { file: "Shaa", ext: "png" },
  "4z": { file: "Pei", ext: "png" },
  "5z": { file: "Haku", ext: "svg" }, // Export PNG/SVG レイヤが空だった
  "6z": { file: "Hatsu", ext: "png" },
  "7z": { file: "Chun", ext: "png" },
};

const SUIT_PREFIX: Record<string, string> = {
  m: "Man",
  p: "Pin",
  s: "Sou",
};

/** 34種 + 赤ドラ3種 */
export const ALL_TILE_CODES: readonly string[] = [
  "1m",
  "2m",
  "3m",
  "4m",
  "5m",
  "0m",
  "6m",
  "7m",
  "8m",
  "9m",
  "1p",
  "2p",
  "3p",
  "4p",
  "5p",
  "0p",
  "6p",
  "7p",
  "8p",
  "9p",
  "1s",
  "2s",
  "3s",
  "4s",
  "5s",
  "0s",
  "6s",
  "7s",
  "8s",
  "9s",
  "1z",
  "2z",
  "3z",
  "4z",
  "5z",
  "6z",
  "7z",
] as const;

export const TILE_BACK_PATH = "/assets/tiles/Back.svg";

export function tileToAssetPath(tile: string): string {
  const suit = tile.slice(-1);
  const raw = tile.slice(0, -1);

  if (suit === "z") {
    const honor = HONOR_FILE[tile];
    if (!honor) {
      return "/assets/tiles/Blank.png";
    }
    return `/assets/tiles/${honor.file}.${honor.ext}`;
  }

  const prefix = SUIT_PREFIX[suit];
  if (!prefix) {
    return "/assets/tiles/Blank.png";
  }

  // 赤ドラ: 0m / 0p / 0s → *-Dora.svg
  // （Export PNG には素材側の識別用ドットが残るため、ドット除去済み SVG を使う）
  if (raw === "0") {
    return `/assets/tiles/${prefix}5-Dora.svg`;
  }

  if (!/^[1-9]$/.test(raw)) {
    return "/assets/tiles/Blank.png";
  }

  return `/assets/tiles/${prefix}${raw}.png`;
}

export function tileAriaLabel(tile: string): string {
  const suit = tile.slice(-1);
  const raw = tile.slice(0, -1);
  if (suit === "z") {
    const labels: Record<string, string> = {
      "1z": "東",
      "2z": "南",
      "3z": "西",
      "4z": "北",
      "5z": "白",
      "6z": "發",
      "7z": "中",
    };
    return labels[tile] ?? tile;
  }
  const suitName = suit === "m" ? "萬" : suit === "p" ? "筒" : "索";
  if (raw === "0") {
    return `赤5${suitName}`;
  }
  return `${raw}${suitName}`;
}

/** デバッグ用: コードと解決パスの対応表 */
export function listTileAssetMappings(): {
  code: string;
  label: string;
  path: string;
}[] {
  return ALL_TILE_CODES.map((code) => ({
    code,
    label: tileAriaLabel(code),
    path: tileToAssetPath(code),
  }));
}
