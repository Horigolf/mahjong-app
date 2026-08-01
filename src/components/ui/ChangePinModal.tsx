"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type ChangePinModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ChangePinModal({ open, onClose }: ChangePinModalProps) {
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPin("");
    setNewPin("");
    setNewPinConfirm("");
    setError(null);
    setSuccess(null);
    setSubmitting(false);
    const t = window.setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
      setError("PINは4桁の数字で入力してください");
      return;
    }
    if (newPin !== newPinConfirm) {
      setError("新しいPINが一致しません");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/change-pin", {
        method: "POST",
        body: JSON.stringify({ currentPin, newPin, newPinConfirm }),
      });
      const payload = (await res.json()) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(payload.error ?? "PINの変更に失敗しました");
        return;
      }
      setSuccess(
        payload.message ??
          "PINを変更しました。次回ログインから新しいPINをご利用ください。",
      );
      setCurrentPin("");
      setNewPin("");
      setNewPinConfirm("");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-2xl bg-surface p-4 shadow-xl shadow-black/40"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            PIN変更
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-600 px-2 py-0.5 text-xs text-muted hover:border-neutral-400 hover:text-foreground"
          >
            閉じる
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="current-pin" className="text-xs text-muted">
              現在のPIN
            </label>
            <input
              ref={firstInputRef}
              id="current-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              pattern="\d{4}"
              maxLength={4}
              value={currentPin}
              onChange={(e) =>
                setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="h-11 rounded-lg border border-neutral-600 bg-neutral-900 px-3 text-center tracking-[0.3em] text-foreground outline-none focus:border-neutral-400"
              placeholder="••••"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="new-pin" className="text-xs text-muted">
              新しいPIN（4桁）
            </label>
            <input
              id="new-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="\d{4}"
              maxLength={4}
              value={newPin}
              onChange={(e) =>
                setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="h-11 rounded-lg border border-neutral-600 bg-neutral-900 px-3 text-center tracking-[0.3em] text-foreground outline-none focus:border-neutral-400"
              placeholder="••••"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="new-pin-confirm" className="text-xs text-muted">
              新しいPIN（確認）
            </label>
            <input
              id="new-pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="\d{4}"
              maxLength={4}
              value={newPinConfirm}
              onChange={(e) =>
                setNewPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="h-11 rounded-lg border border-neutral-600 bg-neutral-900 px-3 text-center tracking-[0.3em] text-foreground outline-none focus:border-neutral-400"
              placeholder="••••"
              required
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="text-sm text-emerald-400">
              {success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || Boolean(success)}
            className="h-11 rounded-lg bg-neutral-100 text-sm font-semibold text-neutral-900 transition enabled:hover:bg-white disabled:opacity-50"
          >
            {submitting ? "変更中…" : success ? "変更済み" : "PINを変更"}
          </button>
        </form>
      </div>
    </div>
  );
}
