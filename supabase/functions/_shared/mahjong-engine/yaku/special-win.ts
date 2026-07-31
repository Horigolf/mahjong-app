import type { WinContext, YakuResult } from "./types.ts";

/** 嶺上開花 */
export function checkRinshan(context: WinContext): YakuResult | null {
  if (context.isRinshan) {
    return { name: "嶺上開花", han: 1 };
  }
  return null;
}

/** 槍槓 */
export function checkChankan(context: WinContext): YakuResult | null {
  if (context.isChankan) {
    return { name: "槍槓", han: 1 };
  }
  return null;
}

/** 海底摸月（ツモ和了時のフラグとして渡される想定） */
export function checkHaitei(context: WinContext): YakuResult | null {
  if (context.isHaitei) {
    return { name: "海底摸月", han: 1 };
  }
  return null;
}

/** 河底撈魚（ロン和了時のフラグとして渡される想定） */
export function checkHoutei(context: WinContext): YakuResult | null {
  if (context.isHoutei) {
    return { name: "河底撈魚", han: 1 };
  }
  return null;
}

/** 特殊和了系（嶺上・槍槓・海底・河底）をまとめて判定 */
export function checkSpecialWins(context: WinContext): YakuResult[] {
  return [
    checkRinshan(context),
    checkChankan(context),
    checkHaitei(context),
    checkHoutei(context),
  ].filter((r): r is YakuResult => r !== null);
}
