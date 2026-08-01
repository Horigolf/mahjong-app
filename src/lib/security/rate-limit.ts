type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

/**
 * プロセス内メモリの簡易レート制限（単一 Node プロセス向け）。
 * サーバーレスの複数インスタンスでは完全ではないが、MVP の最低限対策。
 */
export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { ok: true };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export const RATE_LIMITS = {
  /** 知り合い同士の複数アカウント作成を妨げないよう緩め */
  register: { limit: 20, windowMs: 15 * 60 * 1000 },
  login: { limit: 60, windowMs: 15 * 60 * 1000 },
  changePin: { limit: 30, windowMs: 15 * 60 * 1000 },
  createRoom: { limit: 20, windowMs: 15 * 60 * 1000 },
  joinRoom: { limit: 60, windowMs: 15 * 60 * 1000 },
} as const;
