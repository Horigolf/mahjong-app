import { notFound } from "next/navigation";
import { Tile } from "@/components/game/Tile";
import {
  ALL_TILE_CODES,
  listTileAssetMappings,
  TILE_BACK_PATH,
} from "@/lib/mahjong/tile-asset";

export const dynamic = "force-dynamic";

/**
 * 開発用: 全34種 + 赤ドラ3 + 裏面の表示確認。
 * 本番では 404。
 */
export default function DevTilesPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const mappings = listTileAssetMappings();
  const suits = [
    { title: "萬子 (m)", codes: ALL_TILE_CODES.filter((c) => c.endsWith("m")) },
    { title: "筒子 (p)", codes: ALL_TILE_CODES.filter((c) => c.endsWith("p")) },
    { title: "索子 (s)", codes: ALL_TILE_CODES.filter((c) => c.endsWith("s")) },
    { title: "字牌 (z)", codes: ALL_TILE_CODES.filter((c) => c.endsWith("z")) },
  ];

  return (
    <main className="min-h-dvh bg-neutral-950 px-4 py-6 text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold tracking-wide">牌アセット確認</h1>
        <p className="mt-1 text-sm text-neutral-400">
          開発専用（/dev/tiles）。全 {ALL_TILE_CODES.length} 種 + 裏面。
          1索は鳥絵柄が正常です。
        </p>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">裏面（暗槓用）</h2>
          <div className="flex items-end gap-3 rounded-xl bg-neutral-900 p-4">
            <Tile tile="1m" faceDown size="large" />
            <p className="text-xs text-neutral-500">{TILE_BACK_PATH}</p>
          </div>
        </section>

        {suits.map((group) => (
          <section key={group.title} className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-neutral-300">
              {group.title}
            </h2>
            <div className="flex flex-wrap gap-3 rounded-xl bg-[#1a4536] p-4">
              {group.codes.map((code) => {
                const meta = mappings.find((m) => m.code === code)!;
                return (
                  <div
                    key={code}
                    className="flex w-[4.5rem] flex-col items-center gap-1"
                  >
                    <Tile tile={code} size="medium" />
                    <span className="font-mono text-[0.65rem] text-neutral-200">
                      {code}
                    </span>
                    <span className="text-[0.6rem] text-neutral-400">
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <section className="mt-8 overflow-x-auto">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">
            対応表（コード → ファイル）
          </h2>
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-700 text-neutral-400">
                <th className="px-2 py-1.5 font-medium">code</th>
                <th className="px-2 py-1.5 font-medium">label</th>
                <th className="px-2 py-1.5 font-medium">path</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((row) => (
                <tr
                  key={row.code}
                  className="border-b border-neutral-800 font-mono"
                >
                  <td className="px-2 py-1 text-emerald-300">{row.code}</td>
                  <td className="px-2 py-1 text-neutral-300">{row.label}</td>
                  <td className="px-2 py-1 text-neutral-500">{row.path}</td>
                </tr>
              ))}
              <tr className="border-b border-neutral-800 font-mono">
                <td className="px-2 py-1 text-emerald-300">faceDown</td>
                <td className="px-2 py-1 text-neutral-300">裏</td>
                <td className="px-2 py-1 text-neutral-500">{TILE_BACK_PATH}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
