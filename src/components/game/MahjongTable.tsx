import { ActionButtons, type ActionItem } from "@/components/game/ActionButtons";
import {
  DiscardPile,
  type DiscardEntry,
} from "@/components/game/DiscardPile";
import { DoraIndicator } from "@/components/game/DoraIndicator";
import { GameSystemTray } from "@/components/game/GameSystemTray";
import { Hand } from "@/components/game/Hand";
import { MeldDisplay, type MeldView } from "@/components/game/MeldDisplay";
import { OpponentSeat } from "@/components/game/OpponentSeat";
import { ScoreBoard, type ScorePlayer } from "@/components/game/ScoreBoard";
import { WinAnimation } from "@/components/game/WinAnimation";
import type { GameResultDisplay } from "@/types/game";

export type TablePlayer = {
  name: string;
  score: number;
  wind: string;
  discards: DiscardEntry[];
  melds: MeldView[];
  isDealer?: boolean;
  isRiichi?: boolean;
  isOffline?: boolean;
};

export type MahjongTableProps = {
  self: TablePlayer & { hand: string[] };
  kamicha: TablePlayer;
  toimen: TablePlayer;
  /** 三麻では null（右列を空ける） */
  shimocha: TablePlayer | null;
  doraIndicators: string[];
  wallRemaining: number;
  kyokuLabel: string;
  honba: number;
  kyotaku: number;
  availableActions: ActionItem[];
  actionHint?: string | null;
  result?: GameResultDisplay | null;
  seatNames?: Record<number, string>;
  onDismissResult?: () => void;
  audioTray?: {
    bgmAvailable: boolean;
    unlocked: boolean;
    paused: boolean;
    volume: number;
    seOn: boolean;
    bgmOn: boolean;
    onUnlock: () => void;
    onToggleSe: () => void;
    onToggleBgm: () => void;
    onTogglePause: () => void;
    onVolume: (volume: number) => void;
  };
  /** オフラインで操作待ちのプレイヤー名（帯表示） */
  waitingForOfflineNames?: string[];
  onAbortHanchan?: () => void;
  aborting?: boolean;
  /** 自分の手番で打牌可能 */
  canDiscard?: boolean;
  /** 打牌可能な牌（リーチ宣言時など） */
  discardEnabledTiles?: string[] | null;
  discardHighlightTiles?: string[] | null;
  onDiscardTile?: (tile: string) => void;
  onAction?: (actionId: string) => void;
};

function SelfBadge({
  player,
}: {
  player: Pick<
    TablePlayer,
    "name" | "score" | "wind" | "isDealer" | "isRiichi" | "isOffline"
  >;
}) {
  return (
    <div className="flex w-full max-w-full flex-col items-start gap-0.5 rounded-md bg-[#0f241c] px-1.5 py-1 ring-1 ring-[#d4c4a0]/35">
      <div className="flex items-center gap-1">
        <span
          className={[
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[0.65rem] font-bold",
            player.isDealer
              ? "bg-[#c9a227] text-[#1a2e26]"
              : "bg-white/10 text-[#f3ead7]",
          ].join(" ")}
          style={{ fontFamily: "var(--font-game-display), serif" }}
        >
          {player.wind}
        </span>
        <p
          className="truncate text-[0.6rem] text-[#d4c4a0]/90"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {player.name}
          {player.isRiichi ? " ·リーチ" : ""}
        </p>
        {player.isOffline ? (
          <span className="shrink-0 rounded bg-red-900/80 px-1 py-px text-[0.55rem] font-semibold text-red-200">
            切断中
          </span>
        ) : null}
      </div>
      <p
        className="w-full text-right text-[0.75rem] font-semibold tabular-nums text-[#f8f1df]"
        style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
      >
        {player.score.toLocaleString("ja-JP")}
      </p>
    </div>
  );
}

/**
 * 対局卓 3×3 グリッド
 *
 * | (空※)  | 対面           | システム※ |
 * | 上家   | 局情報         | 下家/空  |
 * | 自分情報 | 捨て牌+手牌+鳴き | アクション |
 *
 * ※四隅のうち上段左右はプレイヤー情報を置かず空けておく。
 *   右上のみ GameSystemTray（設定・将来の BGM/戦績）を小さく配置。
 */
export function MahjongTable({
  self,
  kamicha,
  toimen,
  shimocha,
  doraIndicators,
  wallRemaining,
  kyokuLabel,
  honba,
  kyotaku,
  availableActions,
  actionHint = null,
  result = null,
  seatNames = {},
  onDismissResult,
  audioTray,
  waitingForOfflineNames = [],
  onAbortHanchan,
  aborting = false,
  canDiscard = false,
  discardEnabledTiles = null,
  discardHighlightTiles = null,
  onDiscardTile,
  onAction,
}: MahjongTableProps) {
  const isSanma = shimocha == null;

  const orderedScores: ScorePlayer[] = shimocha
    ? [
        {
          name: self.name,
          score: self.score,
          wind: self.wind,
          isSelf: true,
          isDealer: self.isDealer,
        },
        {
          name: shimocha.name,
          score: shimocha.score,
          wind: shimocha.wind,
          isDealer: shimocha.isDealer,
        },
        {
          name: toimen.name,
          score: toimen.score,
          wind: toimen.wind,
          isDealer: toimen.isDealer,
        },
        {
          name: kamicha.name,
          score: kamicha.score,
          wind: kamicha.wind,
          isDealer: kamicha.isDealer,
        },
      ]
    : [
        {
          name: self.name,
          score: self.score,
          wind: self.wind,
          isSelf: true,
          isDealer: self.isDealer,
        },
        {
          name: toimen.name,
          score: toimen.score,
          wind: toimen.wind,
          isDealer: toimen.isDealer,
        },
        {
          name: kamicha.name,
          score: kamicha.score,
          wind: kamicha.wind,
          isDealer: kamicha.isDealer,
        },
      ];

  return (
    <div
      className={[
        "game-table relative grid h-full min-h-0 w-full gap-x-1 gap-y-0 overflow-hidden text-[#f3ead7]",
        // 左固定・中央可変・右固定 / 上固定・中央可変・下固定
        "grid-cols-[minmax(5.75rem,7.75rem)_minmax(0,1fr)_minmax(5.75rem,7.75rem)]",
        "grid-rows-[minmax(4.25rem,auto)_minmax(0,1fr)_minmax(5.25rem,auto)]",
        isSanma ? "game-table--sanma" : "",
      ].join(" ")}
      style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,#2f6b52_0%,#1a4536_45%,#0e2a21_100%)]"
      />

      {/* 右上: システム用（設定 / 将来 BGM・戦績）。プレイヤー情報は置かない */}
      <GameSystemTray
        bgmAvailable={audioTray?.bgmAvailable ?? true}
        unlocked={audioTray?.unlocked ?? false}
        paused={audioTray?.paused ?? true}
        volume={audioTray?.volume ?? 0.35}
        seOn={audioTray?.seOn ?? false}
        bgmOn={audioTray?.bgmOn ?? false}
        onUnlock={audioTray?.onUnlock ?? (() => {})}
        onToggleSe={audioTray?.onToggleSe ?? (() => {})}
        onToggleBgm={audioTray?.onToggleBgm ?? (() => {})}
        onTogglePause={audioTray?.onTogglePause ?? (() => {})}
        onVolume={audioTray?.onVolume ?? (() => {})}
        onAbortHanchan={onAbortHanchan}
        aborting={aborting}
      />

      {/* 上段中央: 対面（左右の隅セルは意図的に空） */}
      <section
        className="col-start-2 row-start-1 flex min-h-0 min-w-0 items-center justify-center overflow-hidden px-1 pt-[max(0.2rem,env(safe-area-inset-top))]"
        aria-label="対面"
      >
        <OpponentSeat player={toimen} placement="top" />
      </section>

      {/* 中段左: 上家（縦スペースを使用） */}
      <section
        className="col-start-1 row-start-2 flex min-h-0 min-w-0 overflow-hidden pl-1"
        aria-label="上家"
      >
        <OpponentSeat player={kamicha} placement="left" />
      </section>

      {/* 中段中央: 局情報 */}
      <section
        className="col-start-2 row-start-2 flex min-h-0 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden px-1"
        aria-label="局情報"
      >
        <div className="game-dora-compact shrink-0">
          <DoraIndicator
            doraIndicators={doraIndicators}
            wallRemaining={wallRemaining}
            kyokuLabel={kyokuLabel}
            honba={honba}
            kyotaku={kyotaku}
            compact
          />
        </div>
        <div className="game-dora-full shrink-0">
          <DoraIndicator
            doraIndicators={doraIndicators}
            wallRemaining={wallRemaining}
            kyokuLabel={kyokuLabel}
            honba={honba}
            kyotaku={kyotaku}
          />
        </div>
        <ScoreBoard
          players={orderedScores}
          className="game-scoreboard w-full max-w-md shrink-0"
        />
      </section>

      {/* 中段右: 下家（三麻では空） */}
      <section
        className="col-start-3 row-start-2 flex min-h-0 min-w-0 overflow-hidden pr-1"
        aria-label={shimocha ? "下家" : "下家（なし）"}
      >
        {shimocha ? (
          <OpponentSeat player={shimocha} placement="right" />
        ) : null}
      </section>

      {/* 下段左: 自分の情報 */}
      <section
        className="col-start-1 row-start-3 flex min-h-0 min-w-0 items-end overflow-hidden p-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
        aria-label="自分の情報"
      >
        <SelfBadge player={self} />
      </section>

      {/* 下段中央: 捨て牌 → 手牌（+副露） */}
      <section
        className="col-start-2 row-start-3 flex min-h-0 min-w-0 flex-col items-center justify-end gap-0.5 overflow-hidden px-0.5 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
        aria-label="自分の手牌エリア"
      >
        <div className="flex w-full shrink-0 justify-center overflow-hidden">
          <DiscardPile
            discards={self.discards}
            tileSize="tiny"
            columns={6}
            maxRows={2}
          />
        </div>
        <div className="flex w-full min-w-0 shrink-0 items-end justify-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Hand
            tiles={self.hand}
            tileSize="large"
            interactive={canDiscard}
            enabledTiles={discardEnabledTiles}
            highlightTiles={discardHighlightTiles}
            onTileClick={onDiscardTile}
          />
          {self.melds.length > 0 ? (
            <MeldDisplay
              melds={self.melds}
              tileSize="small"
              showLabels={false}
              className="mb-0.5 shrink-0"
            />
          ) : null}
        </div>
      </section>

      {/* 下段右: アクション */}
      <section
        className="col-start-3 row-start-3 flex min-h-0 min-w-0 items-end justify-end overflow-hidden p-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
        aria-label="アクション"
      >
        <ActionButtons
          actions={availableActions}
          hint={actionHint}
          onAction={onAction}
          className="w-full flex-col items-stretch gap-0.5"
        />
      </section>

      <WinAnimation
        result={result}
        seatNames={seatNames}
        onDismiss={onDismissResult ?? (() => {})}
      />

      {waitingForOfflineNames.length > 0 && !result ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-[max(0.4rem,env(safe-area-inset-top))] z-[55] flex justify-center px-3"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-[min(92vw,28rem)] rounded-lg bg-[#3b1d1d]/92 px-4 py-2 text-center shadow-lg ring-1 ring-red-400/50 backdrop-blur-sm">
            <p
              className="text-sm font-semibold text-[#ffe4e4]"
              style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
            >
              {waitingForOfflineNames.length === 1
                ? `${waitingForOfflineNames[0]}さんの操作待ちです`
                : `${waitingForOfflineNames.join("・")}さんの操作待ちです`}
            </p>
            <p className="mt-0.5 text-[0.65rem] text-[#f0c0c0]/85">
              切断中です。戻らない場合は右上から対局を中断できます
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
