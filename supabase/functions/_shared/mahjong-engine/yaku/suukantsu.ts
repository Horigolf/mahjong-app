import type { WinContext, YakuResult } from "./types.ts";

/**
 * 四槓子: カンが4つ。
 */
export function checkSuukantsu(context: WinContext): YakuResult | null {
  const kans = context.melds.filter((m) =>
    m.type === "ankan" || m.type === "minkan" || m.type === "kakan"
  );
  if (kans.length !== 4) return null;
  return { name: "四槓子", han: 1, isYakuman: true };
}
