/** get-my-hand / Realtime game_update 用のクライアント型 */

export type PublicMeld = {
  type: "pon" | "chi" | "ankan" | "minkan" | "kakan";
  tiles: string[];
};

export type PublicDiscard = {
  tile: string;
  seqNumber: number;
  isRiichiTile: boolean;
  isCalled: boolean;
};

export type PublicSeatState = {
  seat: number;
  meldTiles: PublicMeld[];
  discards: PublicDiscard[];
  handCount: number;
  riichiDeclared: boolean;
};

export type PublicGameState = {
  kyokuId: string;
  roomId: string;
  roundWind: string;
  roundNumber: number;
  honba: number;
  kyotaku: number;
  dealerSeat: number;
  currentTurnSeat: number;
  doraIndicators: string[];
  scores: Record<string, number>;
  seats: PublicSeatState[];
  pendingDiscardId: string | null;
  pendingCallSeats: number[];
  pendingDiscard: {
    seat: number;
    tile: string;
    seqNumber: number;
  } | null;
};

export type GetMyHandResponse = {
  myHand: string[];
  mySeat: number;
  publicState: PublicGameState;
};

export type YakuResultView = {
  name: string;
  han: number;
  isYakuman?: boolean;
};

export type RyuukyokuResultView = {
  kind?: "ryuukyoku";
  reason?: string;
  tenpaiSeats: number[];
  notenSeats: number[];
  scoreDeltas: Record<string, number>;
};

export type GameResultDisplay =
  | {
      type: "tsumo" | "ron";
      message: string;
      seat: number;
      fromSeat?: number;
      han: number;
      fu: number;
      points: number;
      yaku: YakuResultView[];
      winningTile?: string;
      hand?: string[];
      melds?: PublicMeld[];
      payments?: Record<string, number>;
      scores?: Record<string, number>;
      nextKyokuId?: string | null;
      hanchanFinished?: boolean;
    }
  | {
      type: "ryuukyoku";
      message: string;
      tenpaiSeats: number[];
      notenSeats: number[];
      scoreDeltas: Record<string, number>;
      scores?: Record<string, number>;
      nextKyokuId?: string | null;
      hanchanFinished?: boolean;
    }
  | {
      type: "chombo";
      message: string;
      offenderSeat: number;
      reason: string;
      penaltyPoints: number;
      payments: Record<string, number>;
      scores?: Record<string, number>;
      nextKyokuId?: string | null;
      hanchanFinished?: boolean;
    };

export type GameUpdatePayload =
  | { type: "hanchan_started"; kyokuId: string; dealerSeat: number }
  | { type: "discard"; seat: number; tile: string; nextTurnSeat: number }
  | {
      type: "waiting_for_calls";
      discardSeat: number;
      tile: string;
      eligibleSeats: number[];
    }
  | { type: "call_skipped"; seat: number; remainingSeats: number[] }
  | {
      type: "calls_resolved";
      discardSeat: number;
      tile: string;
      nextTurnSeat: number | null;
      drawnByNext: boolean;
      ryuukyoku: unknown | null;
    }
  | { type: "pon"; seat: number; tiles: string[]; fromSeat: number }
  | { type: "chi"; seat: number; tiles: string[]; fromSeat: number }
  | {
      type: "kan";
      seat: number;
      tiles: string[];
      fromSeat: number;
      doraIndicators: string[];
    }
  | {
      type: "ankan";
      seat: number;
      tile: string;
      doraIndicators: string[];
    }
  | {
      type: "kakan";
      seat: number;
      tile: string;
      doraIndicators: string[];
    }
  | {
      type: "riichi";
      seat: number;
      isDouble: boolean;
      tile: string;
      kyotaku: number;
      waitingForCalls: boolean;
      eligibleSeats: number[];
      nextTurnSeat: number | null;
    }
  | {
      type: "tsumo";
      seat: number;
      han: number;
      fu: number;
      points: number;
      yaku: YakuResultView[];
      winningTile?: string;
      hand?: string[];
      melds?: PublicMeld[];
      payments?: Record<string, number>;
      scores: Record<string, number>;
      nextKyokuId: string | null;
      hanchanFinished: boolean;
    }
  | {
      type: "ron";
      seat: number;
      fromSeat: number;
      han: number;
      fu: number;
      points: number;
      yaku: YakuResultView[];
      winningTile?: string;
      hand?: string[];
      melds?: PublicMeld[];
      payments?: Record<string, number>;
      scores: Record<string, number>;
      nextKyokuId: string | null;
      hanchanFinished: boolean;
    }
  | {
      type: "ryuukyoku";
      seat: number;
      tile: string;
      nextTurnSeat: null;
      result: RyuukyokuResultView | unknown;
      scores: Record<string, number>;
      nextKyokuId: string | null;
      hanchanFinished: boolean;
    }
  | {
      type: "chombo";
      offenderSeat: number;
      reason?: string;
      penaltyPoints: number;
      payments: Record<string, number>;
      scores: Record<string, number>;
      nextKyokuId: string | null;
      hanchanFinished: boolean;
    }
  | {
      type: "hanchan_aborted";
      roomId: string;
      hanchanId: string;
      abortedBySeat: number;
      scores: Record<string, number>;
      reason: string;
    };
