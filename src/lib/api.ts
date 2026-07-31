import { useAuthStore } from "@/stores/authStore";

/**
 * ログイン済み API 呼び出し。Authorization Bearer を必ず付与する。
 * （Cookie が効かないプライベートモード／LAN 端末向け）
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  let token = useAuthStore.getState().token;
  if (!token) {
    token = await useAuthStore.getState().hydrateToken();
  }

  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
