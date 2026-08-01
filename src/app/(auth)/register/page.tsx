"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";

export default function RegisterPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
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

    if (pin !== pinConfirm) {
      setError("PINが一致しません");
      return;
    }

    setSubmitting(true);

    try {
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, pin }),
      });

      const registerPayload = (await registerRes.json()) as { error?: string };

      if (!registerRes.ok) {
        setError(registerPayload.error ?? "登録に失敗しました");
        return;
      }

      // 登録直後にログインして、別端末／プライベートでもすぐ使えるようにする
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, pin }),
      });
      const loginPayload = (await loginRes.json()) as {
        error?: string;
        token?: string;
      };

      if (!loginRes.ok || !loginPayload.token) {
        setError(
          loginPayload.error ??
            "登録は完了しました。ログイン画面から入り直してください",
        );
        router.push("/login");
        return;
      }

      setToken(loginPayload.token);
      router.push("/");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex h-full w-full items-center justify-center px-6 py-3">
      <div className="w-full max-w-3xl">
        <h1 className="mb-3 text-lg font-semibold tracking-wide text-foreground">
          新規登録
        </h1>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lg shadow-black/30 sm:flex-row sm:items-end"
        >
          <div className="flex min-w-0 w-full flex-col gap-1 sm:flex-1">
            <label htmlFor="name" className="text-xs text-muted">
              名前（1〜20文字）
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
                autoComplete="new-password"
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

            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:w-28 sm:flex-none sm:shrink-0">
              <label htmlFor="pinConfirm" className="text-xs text-muted">
                PIN確認
              </label>
              <input
                id="pinConfirm"
                name="pinConfirm"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d{4}"
                maxLength={4}
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="h-11 w-full rounded-lg border border-neutral-600 bg-neutral-900 px-3 text-center text-base tracking-[0.3em] text-foreground outline-none focus:border-neutral-400"
                placeholder="••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full shrink-0 rounded-lg bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 transition enabled:hover:bg-white disabled:opacity-50 sm:w-auto sm:min-w-28"
          >
            {submitting ? "登録中…" : "登録して入る"}
          </button>
        </form>

        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-400">
            {error}
          </p>
        ) : null}

        <p className="mt-3 text-sm text-muted">
          アカウント済みの方は{" "}
          <Link href="/login" className="text-foreground underline">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  );
}
