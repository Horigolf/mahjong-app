"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

/**
 * Cookie ではなくタブのトークンで表示名を取る（複数アカウント確認向け）。
 */
export function UserMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const clearToken = useAuthStore((s) => s.clearToken);
  const [name, setName] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const isGameTable = /^\/rooms\/[^/]+$/.test(pathname);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await useAuthStore.getState().hydrateToken();
      if (!token) {
        if (!cancelled) setName(null);
        return;
      }
      try {
        const res = await apiFetch("/api/auth/me");
        if (!res.ok) {
          if (!cancelled) setName(null);
          return;
        }
        const me = (await res.json()) as { name: string };
        if (!cancelled) setName(me.name);
      } catch {
        if (!cancelled) setName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (isGameTable || !name) {
    return null;
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const token = useAuthStore.getState().token;
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      clearToken();
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="absolute top-2 right-3 z-40 flex items-center gap-3 rounded-full bg-surface/90 px-3 py-1.5 text-sm shadow-md shadow-black/20 backdrop-blur">
      <span className="max-w-32 truncate text-foreground">{name}</span>
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={loggingOut}
        className="rounded-full border border-neutral-600 px-2.5 py-0.5 text-xs text-muted transition hover:border-neutral-400 hover:text-foreground disabled:opacity-50"
      >
        {loggingOut ? "…" : "ログアウト"}
      </button>
    </div>
  );
}
