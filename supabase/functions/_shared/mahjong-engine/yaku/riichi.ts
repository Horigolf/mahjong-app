import type { WinContext, YakuResult } from "./types.ts";

/**
 * 立直 / 両立直。
 * isDoubleRiichi と isRiichi は同時に true にならない前提。
 */
export function checkRiichi(context: WinContext): YakuResult | null {
  if (context.isDoubleRiichi) {
    return { name: "両立直", han: 2 };
  }
  if (context.isRiichi) {
    return { name: "立直", han: 1 };
  }
  return null;
}
