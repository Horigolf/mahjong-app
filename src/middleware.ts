import { NextResponse, type NextRequest } from "next/server";

/**
 * 部屋ページの認証はクライアント（sessionStorage + Bearer）側で行う。
 * Cookie ミドルウェアだとプライベート複数窓で身分が共有・上書きされるため、
 * ここではブロックしない。
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/rooms/:path*"],
};
