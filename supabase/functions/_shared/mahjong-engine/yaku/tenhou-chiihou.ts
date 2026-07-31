import type { WinContext, YakuResult } from "./types.ts";

/**
 * 天和・地和（いずれもダブル役満として扱う）。
 */
export function checkTenhouChiihou(context: WinContext): YakuResult[] {
  const results: YakuResult[] = [];
  if (context.isTenhou) {
    results.push({ name: "天和", han: 2, isYakuman: true });
  }
  if (context.isChiihou) {
    results.push({ name: "地和", han: 2, isYakuman: true });
  }
  return results;
}
