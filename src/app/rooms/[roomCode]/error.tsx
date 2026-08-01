"use client";

import { useEffect } from "react";
import { RoomErrorFallback } from "@/components/ui/RoomErrorFallback";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * /rooms/[roomCode] 配下の Next.js error.tsx 用。
 * Server Component 側の例外もここで受け止め、汎用ホスト画面を避ける。
 */
export default function RoomSegmentError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[rooms error.tsx]", error.message, error.stack, error.digest);
  }, [error]);

  return (
    <RoomErrorFallback
      message={
        error.message
          ? `エラーが発生しました（${error.message}）。トップに戻るか、再試行してください。`
          : undefined
      }
      onRetry={reset}
    />
  );
}
