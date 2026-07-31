import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";

/** タブの Bearer トークンから現在ユーザーを返す */
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ id: user.id, name: user.name });
}
