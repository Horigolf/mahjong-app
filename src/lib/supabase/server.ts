import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

/** anon キー（ブラウザ相当）。RLS の対象になる。 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createClient(url, anonKey);
}

/** サーバー専用（RLS バイパス）。認証・部屋操作などで使用。 */
export { createServiceClient };
