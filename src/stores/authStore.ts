import { create } from "zustand";

const TOKEN_STORAGE_KEY = "mj_session_token";

type AuthState = {
  /** Edge Functions / API 呼び出し用の生セッショントークン（タブごと） */
  token: string | null;
  setToken: (token: string | null) => void;
  clearToken: () => void;
  /** このタブの sessionStorage から復元（Cookie / localStorage は使わない） */
  hydrateToken: () => Promise<string | null>;
};

/**
 * 重要: Edge / Chrome のプライベートウィンドウ同士は Cookie・localStorage を共有する。
 * 複数アカウントの同時確認ではタブごとに分離できる sessionStorage のみを使う。
 */
function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    // 旧実装の localStorage / Cookie が他タブの身分を上書きしないよう掃除
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function clearSharedSessionCookie() {
  if (typeof document === "undefined") return;
  // 共有 Cookie が残っていると SSR / middleware が別人になるため消す
  document.cookie =
    "session_token=; Path=/; Max-Age=0; SameSite=Lax";
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  setToken: (token) => {
    writeStoredToken(token);
    clearSharedSessionCookie();
    set({ token });
  },
  clearToken: () => {
    writeStoredToken(null);
    clearSharedSessionCookie();
    set({ token: null });
  },
  hydrateToken: async () => {
    clearSharedSessionCookie();
    const existing = get().token ?? readStoredToken();
    if (existing) {
      if (!get().token) set({ token: existing });
      return existing;
    }
    // Cookie 由来の /api/auth/token は使わない（プライベート複数窓で別人になる）
    return null;
  },
}));
