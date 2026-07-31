import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { isMenzen } from "./utils.ts";

/** 門前清自摸和: ツモかつ門前（暗槓のみは門前扱い）なら1翻 */
export function checkMenzenTsumo(context: WinContext): YakuResult | null {
  if (context.isTsumo && isMenzen(context)) {
    return { name: "門前清自摸和", han: 1 };
  }
  return null;
}
