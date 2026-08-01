"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MahjongTable } from "@/components/game/MahjongTable";
import type { ActionItem } from "@/components/game/ActionButtons";
import { useGameRealtime } from "@/hooks/useGameRealtime";
import { callEdgeFunction } from "@/lib/supabase/functions";
import {
  canMinkanHand,
  canPonHand,
  enumerateChiChoices,
  enumerateKanChoices,
  isMenzenMelds,
  kamichaSeat,
  riichiDiscardTiles,
  type ChiChoice,
  type KanChoice,
} from "@/lib/mahjong/actions";
import {
  buildTablePlayers,
  estimateWallRemaining,
  formatKyokuLabel,
} from "@/lib/mahjong/table-view";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { useGameAudio } from "@/lib/audio/useGameAudio";
import type { GameType } from "@/types/room";

type UiMode =
  | { kind: "idle" }
  | { kind: "chi_select"; choices: ChiChoice[] }
  | { kind: "riichi_select"; tiles: string[] }
  | { kind: "kan_select"; choices: KanChoice[] };

type GameScreenProps = {
  roomId: string;
  kyokuId: string;
  roomCode: string;
  gameType: GameType;
  seatNames: Record<number, string>;
  /** rooms.rule_config.se（未設定は false） */
  seEnabled?: boolean;
  /** rooms.rule_config.bgm（未設定は false） */
  bgmEnabled?: boolean;
};

/**
 * Realtime + gameStore を MahjongTable に接続する対局画面本体。
 */
export function GameScreen({
  roomId,
  kyokuId,
  roomCode,
  gameType,
  seatNames,
  seEnabled = false,
  bgmEnabled = false,
}: GameScreenProps) {
  const { resync, dismissResult } = useGameRealtime(kyokuId, roomId);
  const audio = useGameAudio({ se: seEnabled, bgm: bgmEnabled });

  const myHand = useGameStore((s) => s.myHand);
  const mySeat = useGameStore((s) => s.mySeat);
  const publicState = useGameStore((s) => s.publicState);
  const resultDisplay = useGameStore((s) => s.resultDisplay);
  const onlineSeats = useGameStore((s) => s.onlineSeats);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [mode, setMode] = useState<UiMode>({ kind: "idle" });
  const router = useRouter();

  const selfSeatState = useMemo(() => {
    if (!publicState || mySeat == null) return null;
    return publicState.seats.find((s) => s.seat === mySeat) ?? null;
  }, [publicState, mySeat]);

  const pendingCalls =
    mySeat != null &&
    publicState != null &&
    publicState.pendingCallSeats.includes(mySeat);

  const isMyTurn =
    mySeat != null &&
    publicState != null &&
    publicState.currentTurnSeat === mySeat &&
    publicState.pendingCallSeats.length === 0;

  const chiChoices = useMemo(() => {
    if (!pendingCalls || !publicState?.pendingDiscard) return [];
    if (mySeat == null) return [];
    if (
      publicState.pendingDiscard.seat !== kamichaSeat(mySeat, gameType)
    ) {
      return [];
    }
    return enumerateChiChoices(myHand, publicState.pendingDiscard.tile);
  }, [pendingCalls, publicState, mySeat, gameType, myHand]);

  const kanChoices = useMemo(() => {
    if (!isMyTurn || !selfSeatState) return [];
    if (myHand.length !== 14) return [];
    return enumerateKanChoices(myHand, selfSeatState.meldTiles);
  }, [isMyTurn, selfSeatState, myHand]);

  const riichiTiles = useMemo(() => {
    if (!isMyTurn || !selfSeatState) return [];
    if (myHand.length !== 14) return [];
    if (!isMenzenMelds(selfSeatState.meldTiles)) return [];
    if (selfSeatState.riichiDeclared) return [];
    const score = publicState?.scores[String(mySeat)] ?? 0;
    if (score < 1000) return [];
    return riichiDiscardTiles(myHand, gameType);
  }, [isMyTurn, selfSeatState, myHand, publicState, mySeat, gameType]);

  const actions: ActionItem[] = useMemo(() => {
    if (busy) return [];

    if (mode.kind === "chi_select") {
      return [
        ...mode.choices.map((c, i) => ({
          id: `chi:${i}`,
          label: `チー ${c.label}`,
          tone: "call" as const,
        })),
        { id: "cancel", label: "キャンセル", tone: "skip" as const },
      ];
    }

    if (mode.kind === "kan_select") {
      return [
        ...mode.choices.map((c, i) => ({
          id: `kan:${i}`,
          label: c.label,
          tone: "call" as const,
        })),
        { id: "cancel", label: "キャンセル", tone: "skip" as const },
      ];
    }

    if (mode.kind === "riichi_select") {
      return [{ id: "cancel", label: "キャンセル", tone: "skip" as const }];
    }

    const list: ActionItem[] = [];

    if (pendingCalls && publicState?.pendingDiscard) {
      const tile = publicState.pendingDiscard.tile;
      if (canPonHand(myHand, tile)) {
        list.push({ id: "pon", label: "ポン", tone: "call" });
      }
      if (chiChoices.length > 0) {
        list.push({ id: "chi", label: "チー", tone: "call" });
      }
      if (canMinkanHand(myHand, tile)) {
        list.push({ id: "minkan", label: "カン", tone: "call" });
      }
      list.push({ id: "ron", label: "ロン", tone: "win" });
      list.push({ id: "skip", label: "スキップ", tone: "skip" });
      return list;
    }

    if (isMyTurn) {
      if (myHand.length === 14) {
        list.push({ id: "tsumo", label: "ツモ", tone: "win" });
      }
      if (riichiTiles.length > 0) {
        list.push({ id: "riichi", label: "リーチ", tone: "riichi" });
      }
      if (kanChoices.length > 0) {
        list.push({ id: "kan_menu", label: "カン", tone: "call" });
      }
    }

    return list;
  }, [
    busy,
    mode,
    pendingCalls,
    publicState,
    myHand,
    chiChoices,
    isMyTurn,
    riichiTiles,
    kanChoices,
  ]);

  const actionHint = useMemo(() => {
    if (mode.kind === "riichi_select") {
      return "リーチする牌をタップ";
    }
    if (mode.kind === "chi_select") {
      return "チーする組み合わせを選択";
    }
    if (mode.kind === "kan_select") {
      return "カンする牌を選択";
    }
    return null;
  }, [mode]);

  const canDiscard =
    !busy &&
    ((isMyTurn && mode.kind === "idle") || mode.kind === "riichi_select");

  const discardEnabledTiles =
    mode.kind === "riichi_select" ? mode.tiles : null;
  const discardHighlightTiles =
    mode.kind === "riichi_select" ? mode.tiles : null;

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      setActionError(null);
      try {
        await fn();
        setMode({ kind: "idle" });
        await resync();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "操作に失敗しました");
      } finally {
        setBusy(false);
      }
    },
    [busy, resync],
  );

  const handleTileClick = useCallback(
    async (tile: string) => {
      if (!publicState || busy) return;

      if (mode.kind === "riichi_select") {
        if (!mode.tiles.includes(tile)) return;
        await run(async () => {
          await callEdgeFunction("declare-riichi", {
            kyokuId: publicState.kyokuId,
            discardTile: tile,
          });
        });
        return;
      }

      if (!isMyTurn || mode.kind !== "idle") return;
      await run(async () => {
        await callEdgeFunction("discard-tile", {
          kyokuId: publicState.kyokuId,
          tile,
        });
        useGameStore.getState().setMyHand(
          useGameStore.getState().myHand.filter((t, i, arr) => {
            const idx = arr.indexOf(tile);
            return i !== idx;
          }),
        );
      });
    },
    [publicState, busy, mode, isMyTurn, run],
  );

  const handleAction = useCallback(
    async (actionId: string) => {
      if (!publicState || busy) return;

      if (actionId === "cancel") {
        setMode({ kind: "idle" });
        setActionError(null);
        return;
      }

      if (actionId.startsWith("chi:")) {
        const idx = Number(actionId.slice(4));
        const choice =
          mode.kind === "chi_select" ? mode.choices[idx] : chiChoices[idx];
        if (!choice) return;
        await run(async () => {
          await callEdgeFunction("call-chi", {
            kyokuId: publicState.kyokuId,
            usedTiles: choice.usedTiles,
          });
        });
        return;
      }

      if (actionId.startsWith("kan:")) {
        const idx = Number(actionId.slice(4));
        const choice =
          mode.kind === "kan_select" ? mode.choices[idx] : kanChoices[idx];
        if (!choice) return;
        await run(async () => {
          await callEdgeFunction("declare-kan", {
            kyokuId: publicState.kyokuId,
            tile: choice.tile,
            kanType: choice.kanType,
          });
        });
        return;
      }

      switch (actionId) {
        case "skip":
          await run(async () => {
            await callEdgeFunction("skip-call", {
              kyokuId: publicState.kyokuId,
            });
          });
          break;
        case "pon":
          await run(async () => {
            await callEdgeFunction("call-pon", {
              kyokuId: publicState.kyokuId,
            });
          });
          break;
        case "ron":
          await run(async () => {
            await callEdgeFunction("call-ron", {
              kyokuId: publicState.kyokuId,
            });
          });
          break;
        case "minkan":
          await run(async () => {
            await callEdgeFunction("call-kan", {
              kyokuId: publicState.kyokuId,
            });
          });
          break;
        case "chi":
          if (chiChoices.length === 1) {
            await run(async () => {
              await callEdgeFunction("call-chi", {
                kyokuId: publicState.kyokuId,
                usedTiles: chiChoices[0]!.usedTiles,
              });
            });
          } else if (chiChoices.length > 1) {
            setMode({ kind: "chi_select", choices: chiChoices });
          }
          break;
        case "riichi":
          if (riichiTiles.length > 0) {
            setMode({ kind: "riichi_select", tiles: riichiTiles });
          }
          break;
        case "tsumo":
          await run(async () => {
            await callEdgeFunction("call-tsumo", {
              kyokuId: publicState.kyokuId,
            });
          });
          break;
        case "kan_menu":
          if (kanChoices.length === 1) {
            const c = kanChoices[0]!;
            await run(async () => {
              await callEdgeFunction("declare-kan", {
                kyokuId: publicState.kyokuId,
                tile: c.tile,
                kanType: c.kanType,
              });
            });
          } else if (kanChoices.length > 1) {
            setMode({ kind: "kan_select", choices: kanChoices });
          }
          break;
        default:
          break;
      }
    },
    [
      publicState,
      busy,
      mode,
      chiChoices,
      kanChoices,
      riichiTiles,
      run,
    ],
  );

  if (loading && !publicState) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#d4c4a0]">
        対局データを読み込み中…（{roomCode}）
      </div>
    );
  }

  if (error && !publicState) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <p className="text-xs text-[#d4c4a0]/80">
          トークン切れの場合は再ログインしてください
        </p>
      </div>
    );
  }

  if (!publicState || mySeat == null) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#d4c4a0]">
        対局データがありません
      </div>
    );
  }

  let players;
  try {
    players = buildTablePlayers({
      publicState,
      mySeat,
      myHand,
      gameType,
      seatNames,
      onlineSeats,
    });
  } catch (e) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-300">
        {e instanceof Error ? e.message : "卓の構築に失敗しました"}
      </div>
    );
  }

  const waitingForOfflineNames = (() => {
    if (!onlineSeats) return [];
    const names: string[] = [];
    const pushSeat = (seat: number) => {
      if (onlineSeats.includes(seat)) return;
      const name = seatNames[seat] ?? `席${seat + 1}`;
      if (!names.includes(name)) names.push(name);
    };
    if (publicState.pendingCallSeats.length > 0) {
      for (const seat of publicState.pendingCallSeats) {
        pushSeat(seat);
      }
    } else {
      pushSeat(publicState.currentTurnSeat);
    }
    return names;
  })();

  async function handleAbortHanchan() {
    if (aborting) return;
    setAborting(true);
    setActionError(null);
    try {
      await useAuthStore.getState().hydrateToken();
      await callEdgeFunction("abort-hanchan", { roomId });
      router.replace(`/rooms/${roomCode}/lobby`);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "対局の中断に失敗しました",
      );
    } finally {
      setAborting(false);
    }
  }

  return (
    <>
      {(actionError || error) && (
        <div className="pointer-events-none absolute left-1/2 top-10 z-[70] max-w-[90vw] -translate-x-1/2 rounded-md bg-black/70 px-3 py-1.5 text-center text-xs text-red-200">
          {actionError ?? error}
        </div>
      )}
      <MahjongTable
        self={players.self}
        kamicha={players.kamicha}
        toimen={players.toimen}
        shimocha={players.shimocha}
        doraIndicators={publicState.doraIndicators}
        wallRemaining={estimateWallRemaining(publicState, gameType)}
        kyokuLabel={formatKyokuLabel(
          publicState.roundWind,
          publicState.roundNumber,
        )}
        honba={publicState.honba}
        kyotaku={publicState.kyotaku}
        availableActions={actions}
        actionHint={actionHint}
        result={resultDisplay}
        seatNames={seatNames}
        onDismissResult={dismissResult}
        waitingForOfflineNames={waitingForOfflineNames}
        onAbortHanchan={() => {
          void handleAbortHanchan();
        }}
        aborting={aborting}
        audioTray={{
          bgmAvailable: audio.bgmAvailable,
          unlocked: audio.unlocked,
          paused: audio.paused,
          volume: audio.volume,
          seOn: audio.seOn,
          bgmOn: audio.bgmOn,
          onUnlock: () => {
            void audio.handleUnlockClick();
          },
          onToggleSe: () => {
            void audio.handleToggleSe();
          },
          onToggleBgm: () => {
            void audio.handleToggleBgm();
          },
          onTogglePause: () => {
            void audio.handleTogglePause();
          },
          onVolume: audio.handleVolume,
        }}
        canDiscard={canDiscard}
        discardEnabledTiles={discardEnabledTiles}
        discardHighlightTiles={discardHighlightTiles}
        onDiscardTile={handleTileClick}
        onAction={handleAction}
      />
    </>
  );
}
