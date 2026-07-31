export type GameType = "yonma" | "sanma";
export type LengthType = "tonpuusen" | "hanchan";

/** rooms.rule_config */
export type RoomRuleConfig = {
  akaDora: boolean;
  kuitan: boolean;
  atozuke: boolean;
  /** 効果音（未設定時は true） */
  se?: boolean;
  /** BGM（未設定時は true） */
  bgm?: boolean;
};

export type RoomSeatView = {
  id: string;
  seatIndex: number;
  userId: string | null;
  userName: string | null;
  isConnected: boolean;
};

export type RoomLobbyData = {
  id: string;
  roomCode: string;
  gameType: GameType;
  lengthType: LengthType;
  hostUserId: string | null;
  seats: RoomSeatView[];
};

/** ホームの部屋一覧用 */
export type RoomListItem = {
  id: string;
  roomCode: string;
  gameType: GameType;
  lengthType: LengthType;
  status: "waiting" | "in_progress" | string;
  hostName: string | null;
  occupiedSeats: number;
  maxSeats: number;
  playerNames: string[];
  /** 自分が着席中か */
  iAmSeated: boolean;
};
