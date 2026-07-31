import { create } from "zustand";
import type {
  GameResultDisplay,
  GetMyHandResponse,
  PublicGameState,
  PublicSeatState,
} from "@/types/game";

type GameState = {
  myHand: string[];
  mySeat: number | null;
  publicState: PublicGameState | null;
  resultDisplay: GameResultDisplay | null;
  /** Presence でオンラインな座席。未同期時は null（全員オンライン扱い） */
  onlineSeats: number[] | null;
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  applySnapshot: (snapshot: GetMyHandResponse) => void;
  setPublicState: (publicState: PublicGameState) => void;
  patchPublicState: (
    updater: (prev: PublicGameState) => PublicGameState,
  ) => void;
  setMyHand: (myHand: string[]) => void;
  setResultDisplay: (result: GameResultDisplay | null) => void;
  setOnlineSeats: (seats: number[] | null) => void;
  reset: () => void;
};

const initial = {
  myHand: [] as string[],
  mySeat: null as number | null,
  publicState: null as PublicGameState | null,
  resultDisplay: null as GameResultDisplay | null,
  onlineSeats: null as number[] | null,
  loading: false,
  error: null as string | null,
};

export function updateSeat(
  seats: PublicSeatState[],
  seat: number,
  updater: (s: PublicSeatState) => PublicSeatState,
): PublicSeatState[] {
  return seats.map((s) => (s.seat === seat ? updater(s) : s));
}

export const useGameStore = create<GameState>((set) => ({
  ...initial,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  applySnapshot: (snapshot) =>
    set((state) => {
      const sameKyoku =
        state.publicState?.kyokuId === snapshot.publicState.kyokuId;
      return {
        myHand: snapshot.myHand,
        mySeat: snapshot.mySeat,
        publicState: snapshot.publicState,
        // 結果演出中の同一局 resync ではオーバーレイを消さない
        resultDisplay: sameKyoku ? state.resultDisplay : null,
        loading: false,
        error: null,
      };
    }),
  setPublicState: (publicState) => set({ publicState }),
  patchPublicState: (updater) =>
    set((state) =>
      state.publicState
        ? { publicState: updater(state.publicState) }
        : state,
    ),
  setMyHand: (myHand) => set({ myHand }),
  setResultDisplay: (resultDisplay) => set({ resultDisplay }),
  setOnlineSeats: (onlineSeats) => set({ onlineSeats }),
  reset: () => set({ ...initial }),
}));
