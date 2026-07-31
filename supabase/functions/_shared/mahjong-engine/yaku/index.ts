import { decomposeHand, type Decomposition } from "../shanten.ts";
import { checkChanta } from "./chanta.ts";
import { checkChiitoitsu } from "./chiitoitsu.ts";
import { checkChinitsu } from "./chinitsu.ts";
import { checkChinroutou } from "./chinroutou.ts";
import { checkChuuren } from "./chuuren.ts";
import { checkDaisangen } from "./daisangen.ts";
import { checkHonitsu } from "./honitsu.ts";
import { checkHonroutou } from "./honroutou.ts";
import { checkIipeikou } from "./iipeikou.ts";
import { checkIppatsu } from "./ippatsu.ts";
import { checkIttsuu } from "./ittsuu.ts";
import { checkJunchan } from "./junchan.ts";
import { checkKokushi } from "./kokushi.ts";
import { checkMenzenTsumo } from "./menzen-tsumo.ts";
import { checkPinfu } from "./pinfu.ts";
import { checkRiichi } from "./riichi.ts";
import { checkRyanpeikou } from "./ryanpeikou.ts";
import { checkRyuuiisou } from "./ryuuiisou.ts";
import { checkSanankou } from "./sanankou.ts";
import { checkSanshokuDoujun } from "./sanshoku-doujun.ts";
import { checkSanshokuDoukou } from "./sanshoku-doukou.ts";
import { checkShousangen } from "./shousangen.ts";
import { checkSpecialWins } from "./special-win.ts";
import { checkSuuankou } from "./suuankou.ts";
import { checkSuukantsu } from "./suukantsu.ts";
import { checkSuushi } from "./suushi.ts";
import { checkTanyao } from "./tanyao.ts";
import { checkTenhouChiihou } from "./tenhou-chiihou.ts";
import { checkToitoi } from "./toitoi.ts";
import { checkTsuuiisou } from "./tsuuiisou.ts";
import { checkYakuhai } from "./yakuhai.ts";
import type { WinContext, YakuResult } from "./types.ts";

export type { Meld, WinContext, YakuResult } from "./types.ts";
export { checkMenzenTsumo } from "./menzen-tsumo.ts";
export { checkRiichi } from "./riichi.ts";
export { checkIppatsu } from "./ippatsu.ts";
export {
  checkRinshan,
  checkChankan,
  checkHaitei,
  checkHoutei,
  checkSpecialWins,
} from "./special-win.ts";
export { checkTanyao } from "./tanyao.ts";
export { checkYakuhai } from "./yakuhai.ts";
export { checkPinfu } from "./pinfu.ts";
export { checkIipeikou } from "./iipeikou.ts";
export { checkRyanpeikou } from "./ryanpeikou.ts";
export { checkSanshokuDoujun } from "./sanshoku-doujun.ts";
export { checkIttsuu } from "./ittsuu.ts";
export { checkChanta } from "./chanta.ts";
export { checkJunchan } from "./junchan.ts";
export { checkToitoi } from "./toitoi.ts";
export { checkSanankou } from "./sanankou.ts";
export { checkSanshokuDoukou } from "./sanshoku-doukou.ts";
export { checkHonroutou } from "./honroutou.ts";
export { checkShousangen } from "./shousangen.ts";
export { checkChiitoitsu } from "./chiitoitsu.ts";
export { checkHonitsu } from "./honitsu.ts";
export { checkChinitsu } from "./chinitsu.ts";
export { checkKokushi } from "./kokushi.ts";
export { checkSuuankou } from "./suuankou.ts";
export { checkDaisangen } from "./daisangen.ts";
export { checkSuushi } from "./suushi.ts";
export { checkTsuuiisou } from "./tsuuiisou.ts";
export { checkRyuuiisou } from "./ryuuiisou.ts";
export { checkChinroutou } from "./chinroutou.ts";
export { checkChuuren } from "./chuuren.ts";
export { checkSuukantsu } from "./suukantsu.ts";
export { checkTenhouChiihou } from "./tenhou-chiihou.ts";
export { isMenzen, allSets, allTiles } from "./utils.ts";

function sumHan(results: YakuResult[]): number {
  return results.reduce((acc, r) => acc + r.han, 0);
}

function collectFlagYaku(context: WinContext): YakuResult[] {
  const results: YakuResult[] = [];

  const menzenTsumo = checkMenzenTsumo(context);
  if (menzenTsumo) results.push(menzenTsumo);

  const riichi = checkRiichi(context);
  if (riichi) results.push(riichi);

  const ippatsu = checkIppatsu(context);
  if (ippatsu) results.push(ippatsu);

  results.push(...checkSpecialWins(context));
  return results;
}

/** 面子分解に依存しないスート系役（清一色優先、混一色と排他） */
function collectSuitYaku(context: WinContext): YakuResult[] {
  const chinitsu = checkChinitsu(context);
  if (chinitsu) return [chinitsu];
  const honitsu = checkHonitsu(context);
  if (honitsu) return [honitsu];
  return [];
}

function collectHandYaku(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult[] {
  const results: YakuResult[] = [];

  const tanyao = checkTanyao(context, decomposition);
  if (tanyao) results.push(tanyao);

  const yakuhai = checkYakuhai(context, decomposition);
  if (yakuhai) results.push(yakuhai);

  const pinfu = checkPinfu(context, decomposition);
  if (pinfu) results.push(pinfu);

  const ryanpeikou = checkRyanpeikou(context, decomposition);
  if (ryanpeikou) {
    results.push(ryanpeikou);
  } else {
    const iipeikou = checkIipeikou(context, decomposition);
    if (iipeikou) results.push(iipeikou);
  }

  const sanshoku = checkSanshokuDoujun(context, decomposition);
  if (sanshoku) results.push(sanshoku);

  const ittsuu = checkIttsuu(context, decomposition);
  if (ittsuu) results.push(ittsuu);

  const junchan = checkJunchan(context, decomposition);
  if (junchan) {
    results.push(junchan);
  } else {
    const chanta = checkChanta(context, decomposition);
    if (chanta) results.push(chanta);
  }

  const toitoi = checkToitoi(context, decomposition);
  if (toitoi) results.push(toitoi);

  const sanankou = checkSanankou(context, decomposition);
  if (sanankou) results.push(sanankou);

  const sanshokuDoukou = checkSanshokuDoukou(context, decomposition);
  if (sanshokuDoukou) results.push(sanshokuDoukou);

  const honroutou = checkHonroutou(context, decomposition);
  if (honroutou) results.push(honroutou);

  const shousangen = checkShousangen(context, decomposition);
  if (shousangen) results.push(shousangen);

  results.push(...collectSuitYaku(context));

  return results;
}

/** 七対子経路: 面子分解に依存しない役のみ */
function collectChiitoitsuYaku(context: WinContext): YakuResult[] {
  const results: YakuResult[] = [];

  const chiitoitsu = checkChiitoitsu(context);
  if (!chiitoitsu) return results;
  results.push(chiitoitsu);

  const dummy: Decomposition = { pair: null, sets: [], floating: [] };
  const tanyao = checkTanyao(context, dummy);
  if (tanyao) results.push(tanyao);

  results.push(...collectSuitYaku(context));

  return results;
}

/** 分解に依存しない役満 */
function collectIndependentYakuman(context: WinContext): YakuResult[] {
  const results: YakuResult[] = [];
  results.push(...checkTenhouChiihou(context));

  const kokushi = checkKokushi(context);
  if (kokushi) results.push(kokushi);

  const tsuuiisou = checkTsuuiisou(context);
  if (tsuuiisou) results.push(tsuuiisou);

  const ryuuiisou = checkRyuuiisou(context);
  if (ryuuiisou) results.push(ryuuiisou);

  const chinroutou = checkChinroutou(context);
  if (chinroutou) results.push(chinroutou);

  const chuuren = checkChuuren(context);
  if (chuuren) results.push(chuuren);

  const suukantsu = checkSuukantsu(context);
  if (suukantsu) results.push(suukantsu);

  return results;
}

/** 分解依存の役満 */
function collectDecompositionYakuman(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult[] {
  const results: YakuResult[] = [];

  const suuankou = checkSuuankou(context, decomposition);
  if (suuankou) results.push(suuankou);

  const daisangen = checkDaisangen(context, decomposition);
  if (daisangen) results.push(daisangen);

  const suushi = checkSuushi(context, decomposition);
  if (suushi) results.push(suushi);

  return results;
}

function isCompleteDecomposition(
  context: WinContext,
  decomposition: Decomposition,
): boolean {
  return (
    decomposition.pair !== null &&
    decomposition.floating.length === 0 &&
    decomposition.sets.length + context.melds.length === 4
  );
}

/**
 * 成立する役を列挙する。
 * 役満が1つでもあれば役満のみを返す（通常役は無視）。
 * 役満が無ければ経路A/Bのうち翻数合計が高い方を採用。
 */
export function detectYaku(context: WinContext): YakuResult[] {
  const independentYakuman = collectIndependentYakuman(context);
  const decompositions = decomposeHand(context.hand).filter((d) =>
    isCompleteDecomposition(context, d)
  );

  let bestDecoYakuman: YakuResult[] = [];
  let bestDecoYakumanHan = 0;
  for (const decomposition of decompositions) {
    const decoYakuman = collectDecompositionYakuman(context, decomposition);
    const han = sumHan(decoYakuman);
    if (han > bestDecoYakumanHan) {
      bestDecoYakuman = decoYakuman;
      bestDecoYakumanHan = han;
    }
  }

  const yakuman = [...independentYakuman, ...bestDecoYakuman];
  if (yakuman.length > 0) {
    return yakuman;
  }

  const flagYaku = collectFlagYaku(context);

  let best: YakuResult[] = [...flagYaku];
  let bestHan = sumHan(best);

  for (const decomposition of decompositions) {
    const handYaku = collectHandYaku(context, decomposition);
    const combined = [...flagYaku, ...handYaku];
    const han = sumHan(combined);
    if (han > bestHan) {
      best = combined;
      bestHan = han;
    }
  }

  const chiitoitsuYaku = collectChiitoitsuYaku(context);
  if (chiitoitsuYaku.length > 0) {
    const combined = [...flagYaku, ...chiitoitsuYaku];
    const han = sumHan(combined);
    if (han > bestHan) {
      best = combined;
      bestHan = han;
    }
  }

  return best;
}
