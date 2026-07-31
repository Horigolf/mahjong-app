import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { countAnkou } from "./ankou-helpers.ts";

/**
 * 三暗刻: 暗刻が3つ以上あれば 2翻。
 * 暗刻判定は ankou-helpers（ロン完成刻は明刻）に従う。
 */
export function checkSanankou(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  if (countAnkou(context, decomposition) < 3) return null;
  return { name: "三暗刻", han: 2 };
}
