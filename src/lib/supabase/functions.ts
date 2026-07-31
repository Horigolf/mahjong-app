import { createBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";

/**
 * Edge Function を呼び出す。
 * Authorization に authStore の生セッショントークンを載せる。
 */
export async function callEdgeFunction<T>(
  name: string,
  body: object,
): Promise<T> {
  let token = useAuthStore.getState().token;
  if (!token) {
    token = await useAuthStore.getState().hydrateToken();
  }
  if (!token) {
    throw new Error("セッショントークンがありません。再度ログインしてください");
  }

  const supabase = createBrowserClient();
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    // FunctionsHttpError などは context にレスポンスを持つことがある
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = (await context.json()) as { error?: string };
        if (payload.error) {
          throw new Error(payload.error);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== error.message) {
          throw e;
        }
      }
    }
    throw new Error(error.message);
  }

  if (data && typeof data === "object" && "error" in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === "string") {
      throw new Error(msg);
    }
  }

  return data as T;
}
