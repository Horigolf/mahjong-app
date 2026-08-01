import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import { RoomAuthGate } from "@/components/auth/RoomAuthGate";
import { RoomErrorBoundary } from "@/components/ui/RoomErrorBoundary";
import { GameOrientationGate } from "@/components/ui/GameOrientationGate";

const gameDisplay = Shippori_Mincho({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-game-display",
  display: "swap",
});

const gameUi = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-game-ui",
  display: "swap",
});

/**
 * /rooms/[roomCode] 配下のレイアウト。
 * 認証は RoomAuthGate（タブごとの sessionStorage）で行う。
 * レンダー例外は RoomErrorBoundary で捕捉する。
 */
export default function RoomCodeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${gameDisplay.variable} ${gameUi.variable} flex min-h-0 min-w-0 flex-1 flex-col`}
      style={{ minHeight: "100dvh" }}
    >
      <RoomErrorBoundary label="rooms-layout">
        <RoomAuthGate>
          <GameOrientationGate />
          {children}
        </RoomAuthGate>
      </RoomErrorBoundary>
    </div>
  );
}
