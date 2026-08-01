"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

type AdminUser = { id: string; name: string; created_at: string };
type AdminRoom = {
  id: string;
  room_code: string;
  status: string;
  game_type: string;
  length_type: string;
  created_at: string;
};

const WIPE_CONFIRM = "DELETE ALL";

export default function AdminPage() {
  const router = useRouter();
  const clearToken = useAuthStore((s) => s.clearToken);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wipeInput, setWipeInput] = useState("");

  const load = useCallback(async () => {
    setError(null);
    await useAuthStore.getState().hydrateToken();
    const meRes = await apiFetch("/api/auth/me");
    if (meRes.status === 401) {
      router.replace("/login?next=/admin");
      return;
    }
    const me = (await meRes.json()) as { isAdmin?: boolean };
    if (!me.isAdmin) {
      setAllowed(false);
      return;
    }
    setAllowed(true);

    const overview = await apiFetch("/api/admin/overview");
    const payload = (await overview.json()) as {
      error?: string;
      users?: AdminUser[];
      rooms?: AdminRoom[];
    };
    if (!overview.ok) {
      setError(payload.error ?? "一覧の取得に失敗しました");
      return;
    }
    setUsers(payload.users ?? []);
    setRooms(payload.rooms ?? []);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteRoom(roomId: string, roomCode: string) {
    if (!window.confirm(`部屋 ${roomCode} を削除しますか？`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/delete-room", {
        method: "POST",
        body: JSON.stringify({ roomId }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "部屋の削除に失敗しました");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(userId: string, name: string) {
    if (!window.confirm(`ユーザー「${name}」を削除しますか？`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/delete-user", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "ユーザーの削除に失敗しました");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleWipe(event: FormEvent) {
    event.preventDefault();
    if (wipeInput !== WIPE_CONFIRM) {
      setError(`確認文言は「${WIPE_CONFIRM}」と入力してください`);
      return;
    }
    if (
      !window.confirm(
        "全ユーザー・全部屋・全対局データを消します。よろしいですか？",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/wipe-all", {
        method: "POST",
        body: JSON.stringify({ confirm: WIPE_CONFIRM }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "全削除に失敗しました");
        return;
      }
      clearToken();
      router.replace("/register");
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm text-muted">
        確認中…
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6">
        <p className="text-sm text-red-300">管理者のみアクセスできます</p>
        <Link href="/" className="text-sm underline">
          トップへ
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-3 pr-[min(11rem,42vw)]">
        <div>
          <h1 className="text-lg font-semibold text-foreground">管理</h1>
          <p className="mt-1 text-xs text-muted">
            製作者向け。一般ユーザーには表示されません。
          </p>
        </div>
        <Link href="/" className="text-xs text-muted underline">
          トップへ
        </Link>
      </div>

      {error ? (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">部屋</h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="text-xs text-muted underline disabled:opacity-50"
          >
            再読込
          </button>
        </div>
        {rooms.length === 0 ? (
          <p className="text-sm text-muted">部屋はありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-semibold tracking-widest">
                    {room.room_code}
                  </span>
                  <span className="ml-2 text-xs text-muted">
                    {room.status} · {room.game_type}/{room.length_type}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deleteRoom(room.id, room.room_code)}
                  className="shrink-0 rounded-lg border border-red-800/80 px-2 py-1 text-xs text-red-300 disabled:opacity-50"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-foreground">ユーザー</h2>
        {users.length === 0 ? (
          <p className="text-sm text-muted">ユーザーはいません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2"
              >
                <span className="text-sm">{user.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deleteUser(user.id, user.name)}
                  className="shrink-0 rounded-lg border border-red-800/80 px-2 py-1 text-xs text-red-300 disabled:opacity-50"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-4">
        <h2 className="text-sm font-medium text-red-200">危険: 全データ削除</h2>
        <p className="mt-1 text-xs text-red-200/80">
          全ユーザー・部屋・対局を消します。実行後は新規登録が必要です。確認のため{" "}
          <code className="text-red-100">{WIPE_CONFIRM}</code> と入力してください。
        </p>
        <form onSubmit={(e) => void handleWipe(e)} className="mt-3 flex gap-2">
          <input
            value={wipeInput}
            onChange={(e) => setWipeInput(e.target.value)}
            placeholder={WIPE_CONFIRM}
            className="h-10 flex-1 rounded-lg border border-red-800/60 bg-neutral-950 px-3 text-sm"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={busy || wipeInput !== WIPE_CONFIRM}
            className="h-10 rounded-lg bg-red-700 px-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            実行
          </button>
        </form>
      </section>
    </main>
  );
}
