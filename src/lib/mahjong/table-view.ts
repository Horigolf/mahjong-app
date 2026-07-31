import type { TablePlayer } from "@/components/game/MahjongTable";
import type { MeldView } from "@/components/game/MeldDisplay";
import type { GameType } from "@/types/room";
import type {
  PublicGameState,
  PublicMeld,
  PublicSeatState,
} from "@/types/game";

const WIND_TILE_LABEL: Record<string, string> = {
  "1z": "東",
  "2z": "南",
  "3z": "西",
  "4z": "北",
};

const ROUND_WIND_LABEL: Record<string, string> = {
  east: "東",
  south: "南",
  west: "西",
  north: "北",
};

export function formatKyokuLabel(
  roundWind: string,
  roundNumber: number,
): string {
  const wind = ROUND_WIND_LABEL[roundWind] ?? roundWind;
  return `${wind}${roundNumber}局`;
}

export function seatWindLabel(
  seat: number,
  dealerSeat: number,
  playerCount: number,
): string {
  const winds = ["1z", "2z", "3z", "4z"];
  const tile = winds[(seat - dealerSeat + playerCount) % playerCount] ?? "1z";
  return WIND_TILE_LABEL[tile] ?? "東";
}

function toMelds(melds: PublicMeld[]): MeldView[] {
  return melds.map((m) => ({
    type: m.type,
    tiles: m.tiles,
  }));
}

function toTablePlayer(
  seat: PublicSeatState,
  publicState: PublicGameState,
  name: string,
  playerCount: number,
  isOffline = false,
): TablePlayer {
  return {
    name,
    score: publicState.scores[String(seat.seat)] ?? 0,
    wind: seatWindLabel(seat.seat, publicState.dealerSeat, playerCount),
    discards: seat.discards
      .filter((d) => !d.isCalled)
      .map((d) => ({ tile: d.tile, isRiichiTile: d.isRiichiTile })),
    melds: toMelds(seat.meldTiles),
    isDealer: seat.seat === publicState.dealerSeat,
    isRiichi: seat.riichiDeclared,
    isOffline,
  };
}

export type RelativeSeats = {
  selfSeat: number;
  shimochaSeat: number | null;
  toimenSeat: number;
  kamichaSeat: number;
};

/** 自分視点の相対席（四麻: 右=下家 / 三麻: 右なし・次巡を対面位置へ） */
export function relativeSeats(
  mySeat: number,
  gameType: GameType,
): RelativeSeats {
  if (gameType === "sanma") {
    return {
      selfSeat: mySeat,
      shimochaSeat: null,
      toimenSeat: (mySeat + 1) % 3,
      kamichaSeat: (mySeat + 2) % 3,
    };
  }
  return {
    selfSeat: mySeat,
    shimochaSeat: (mySeat + 1) % 4,
    toimenSeat: (mySeat + 2) % 4,
    kamichaSeat: (mySeat + 3) % 4,
  };
}

export function findSeat(
  publicState: PublicGameState,
  seat: number,
): PublicSeatState | undefined {
  return publicState.seats.find((s) => s.seat === seat);
}

export function buildTablePlayers(options: {
  publicState: PublicGameState;
  mySeat: number;
  myHand: string[];
  gameType: GameType;
  seatNames: Record<number, string>;
  onlineSeats?: number[] | null;
}): {
  self: TablePlayer & { hand: string[] };
  shimocha: TablePlayer | null;
  toimen: TablePlayer;
  kamicha: TablePlayer;
} {
  const { publicState, mySeat, myHand, gameType, seatNames, onlineSeats } =
    options;
  const playerCount = gameType === "sanma" ? 3 : 4;
  const rel = relativeSeats(mySeat, gameType);
  const nameOf = (seat: number) => seatNames[seat] ?? `席${seat + 1}`;
  const offline = (seat: number) =>
    onlineSeats != null && !onlineSeats.includes(seat);

  const selfSeat = findSeat(publicState, rel.selfSeat);
  const toimenSeat = findSeat(publicState, rel.toimenSeat);
  const kamichaSeat = findSeat(publicState, rel.kamichaSeat);
  const shimochaSeat =
    rel.shimochaSeat != null
      ? findSeat(publicState, rel.shimochaSeat)
      : undefined;

  if (!selfSeat || !toimenSeat || !kamichaSeat) {
    throw new Error("席データが不足しています");
  }

  return {
    self: {
      ...toTablePlayer(
        selfSeat,
        publicState,
        nameOf(rel.selfSeat),
        playerCount,
        offline(rel.selfSeat),
      ),
      hand: myHand,
    },
    toimen: toTablePlayer(
      toimenSeat,
      publicState,
      nameOf(rel.toimenSeat),
      playerCount,
      offline(rel.toimenSeat),
    ),
    kamicha: toTablePlayer(
      kamichaSeat,
      publicState,
      nameOf(rel.kamichaSeat),
      playerCount,
      offline(rel.kamichaSeat),
    ),
    shimocha: shimochaSeat
      ? toTablePlayer(
          shimochaSeat,
          publicState,
          nameOf(rel.shimochaSeat!),
          playerCount,
          offline(rel.shimochaSeat!),
        )
      : null,
  };
}

/** 山の残り概算（公開情報のみからの推定） */
export function estimateWallRemaining(
  publicState: PublicGameState,
  gameType: GameType,
): number {
  const total = gameType === "sanma" ? 108 : 136;
  const dead = 14;
  let used = publicState.doraIndicators.length;
  for (const seat of publicState.seats) {
    used += seat.handCount;
    used += seat.discards.filter((d) => !d.isCalled).length;
    for (const meld of seat.meldTiles) {
      used += meld.tiles.length;
    }
  }
  return Math.max(0, total - dead - used);
}
