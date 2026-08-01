"use client";

import Link from "next/link";

type RoomErrorFallbackProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

/**
 * ロビー／対局まわりの共通エラー表示。
 * 真っ白やホスティングの汎用画面の代わりに出す。
 */
export function RoomErrorFallback({
  title = "エラーが発生しました",
  message = "対局の表示中に問題が起きました。トップに戻ってやり直してください。",
  onRetry,
}: RoomErrorFallbackProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0e2a21] px-6 text-center text-[#f3ead7]">
      <p
        className="text-lg font-semibold"
        style={{ fontFamily: "var(--font-game-display), serif" }}
      >
        {title}
      </p>
      <p
        className="max-w-md text-sm text-[#d4c4a0]/90"
        style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
      >
        {message}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-[#f8f1df] ring-1 ring-[#d4c4a0]/40 transition hover:bg-white/15"
          >
            再試行
          </button>
        ) : null}
        <Link
          href="/"
          className="rounded-lg bg-[#f8f1df] px-4 py-2 text-sm font-semibold text-[#1a2e26] transition hover:bg-white"
        >
          トップに戻る
        </Link>
      </div>
    </div>
  );
}
