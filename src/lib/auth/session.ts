import { createServiceClient } from "@/lib/supabase/admin";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };

/** ログイン失敗の集計ウィンドウ（分） */
export const LOGIN_ATTEMPT_WINDOW_MINUTES = 15;

/** ウィンドウ内でこの回数を超えたらロック */
export const LOGIN_ATTEMPT_MAX = 5;

export type AuthUser = {
  id: string;
  name: string;
  sessionId: string;
};

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createSessionToken() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashSessionToken(token: string) {
  const data = new TextEncoder().encode(token);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return bytesToHex(digest);
}

export function sessionExpiresAt(from = new Date()) {
  return new Date(from.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
}

function readCookieValue(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

/**
 * セッショントークンから有効なユーザーを解決する。
 * 期限切れ・未登録の場合は null。
 */
export async function getUserFromSessionToken(
  token: string,
): Promise<AuthUser | null> {
  const tokenHash = await hashSessionToken(token);
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("sessions")
    .select("id, expires_at, users!inner(id, name)")
    .eq("token_hash", tokenHash)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) {
    console.error("getUserFromSessionToken failed:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  const user = data.users as unknown as { id: string; name: string };

  return {
    id: user.id,
    name: user.name,
    sessionId: data.id as string,
  };
}

/**
 * Cookie のセッショントークンから現在のユーザーを取得する。
 * Server Components / Route Handlers 向け。
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return getUserFromSessionToken(token);
}

/**
 * API 向け: Authorization Bearer を優先し、なければ Cookie。
 * （プライベートモード等で httpOnly Cookie が効かない端末向け）
 */
export async function getUserFromRequest(
  request: Request,
): Promise<AuthUser | null> {
  const auth = request.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) {
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const user = await getUserFromSessionToken(token);
      if (user) return user;
    }
  }

  const cookieToken = readCookieValue(
    request.headers.get("cookie"),
    SESSION_COOKIE_NAME,
  );
  if (cookieToken) {
    return getUserFromSessionToken(cookieToken);
  }

  return getCurrentUser();
}
