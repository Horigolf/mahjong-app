import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** src/lib/auth/session.ts の hashSessionToken と同じ SHA-256 hex */
export async function hashSessionToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(digest);
}

/**
 * Authorization: Bearer <生セッショントークン> を検証する。
 * 有効なら users の id/name、無効なら null。
 */
export async function authenticate(
  req: Request,
  supabase: SupabaseClient,
): Promise<{ id: string; name: string } | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const tokenHash = await hashSessionToken(token);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("sessions")
    .select("id, expires_at, users!inner(id, name)")
    .eq("token_hash", tokenHash)
    .gt("expires_at", now)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const user = data.users as unknown as { id: string; name: string };
  return { id: user.id, name: user.name };
}
