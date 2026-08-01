/**
 * 管理者判定。名前は環境変数 ADMIN_USER_NAMES（カンマ区切り）で指定。
 * 例: ADMIN_USER_NAMES=堀
 */
export function getAdminUserNames(): string[] {
  const raw = process.env.ADMIN_USER_NAMES ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminName(name: string): boolean {
  return getAdminUserNames().includes(name);
}
