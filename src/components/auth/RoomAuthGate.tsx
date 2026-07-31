"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

type AuthMe = {
  id: string;
  name: string;
};

/**
 * 部屋配下は Cookie ではなくタブの sessionStorage トークンで認証する。
 * （プライベート複数窓が Cookie を共有して別人になる問題への対策）
 */
export function RoomAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthMe | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ensureAuth() {
      const token = await useAuthStore.getState().hydrateToken();
      if (!token) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        const res = await apiFetch("/api/auth/me");
        if (!res.ok) {
          useAuthStore.getState().clearToken();
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        const payload = (await res.json()) as AuthMe;
        if (!cancelled) {
          setUser(payload);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
      }
    }

    void ensureAuth();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
        認証確認中…
      </div>
    );
  }

  return <>{children}</>;
}
