import type { WinContext, YakuResult } from "./types.ts";

/**
 * 一発。
 * リーチ済みであることは呼び出し側が保証する。ここでは isIppatsu のみ見る。
 */
export function checkIppatsu(context: WinContext): YakuResult | null {
  if (context.isIppatsu) {
    return { name: "一発", han: 1 };
  }
  return null;
}
