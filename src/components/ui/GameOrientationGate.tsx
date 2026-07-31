"use client";

import { usePathname } from "next/navigation";
import { OrientationGuard } from "@/components/ui/OrientationGuard";

/**
 * 対局本編（/rooms/[roomCode]）だけ OrientationGuard を出す。
 * ロビー（/rooms/[roomCode]/lobby）では出さない。
 */
export function GameOrientationGate() {
  const pathname = usePathname();
  const isGameTable = /^\/rooms\/[^/]+$/.test(pathname);

  if (!isGameTable) {
    return null;
  }

  return <OrientationGuard />;
}
