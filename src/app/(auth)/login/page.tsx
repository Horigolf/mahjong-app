"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { AddToHomeScreenTip } from "@/components/ui/AddToHomeScreenTip";
import { TileAttribution } from "@/components/ui/TileAttribution";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setToken = useAuthStore((s) => s.setToken);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();

    if (trimmedName.length < 1 || trimmedName.length > 20) {
      setError("名前は1〜20文字で入力してください");
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError("PINは4桁の数字で入力してください");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, pin }),
      });

      const payload = (await response.json()) as {
        error?: string;
        token?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "ログインに失敗しました");
        return;
      }

      if (payload.token) {
        setToken(payload.token);
      }

      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : "/");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted">
        複数人テスト: Edge
        のプライベート窓同士はログイン情報が共有されます。別アカウントは「通常ウィンドウ
        / 別ブラウザ / 別端末」で分けてください。各タブではログインし直してください。
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lg shadow-black/30 sm:flex-row sm:items-end"
      >
        <div className="flex min-w-0 w-full flex-col gap-1 sm:flex-1">
          <label htmlFor="name" className="text-xs text-muted">
            名前
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="username"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 w-full rounded-lg border border-neutral-600 bg-neutral-900 px-3 text-base text-foreground outline-none focus:border-neutral-400"
            placeholder="プレイヤー名"
            required
          />
        </div>

        <div className="flex w-full gap-3 sm:w-auto sm:contents">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:w-28 sm:flex-none sm:shrink-0">
            <label htmlFor="pin" className="text-xs text-muted">
              PIN（4桁）
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="h-11 w-full rounded-lg border border-neutral-600 bg-neutral-900 px-3 text-center text-base tracking-[0.3em] text-foreground outline-none focus:border-neutral-400"
              placeholder="••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 min-w-0 flex-1 rounded-lg bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 transition enabled:hover:bg-white disabled:opacity-50 sm:w-auto sm:flex-none sm:min-w-28"
          >
            {submitting ? "確認中…" : "ログイン"}
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="flex h-full w-full items-center justify-center px-6 py-3">
      <div className="w-full max-w-3xl">
        <h1 className="mb-3 text-lg font-semibold tracking-wide text-foreground">
          ログイン
        </h1>

        <Suspense fallback={<p className="text-sm text-muted">読込中…</p>}>
          <LoginForm />
        </Suspense>

        <p className="mt-3 text-sm text-muted">
          アカウント未作成の方は{" "}
          <Link href="/register" className="text-foreground underline">
            新規登録
          </Link>
        </p>

        <AddToHomeScreenTip className="mt-4" />
        <TileAttribution className="mt-3" />
      </div>
    </main>
  );
}
