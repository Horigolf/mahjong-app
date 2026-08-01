"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { GameType, LengthType } from "@/types/room";

type RuleKey = "akaDora" | "kuitan" | "atozuke" | "yakitori" | "se" | "bgm";

const RULE_OPTIONS: { key: RuleKey; label: string; description: string }[] = [
  { key: "akaDora", label: "赤ドラ", description: "赤牌あり" },
  { key: "kuitan", label: "喰いタン", description: "鳴きタンヤオあり" },
  { key: "atozuke", label: "後付け", description: "後付けあり" },
  { key: "yakitori", label: "焼き鳥", description: "未和了ペナルティ" },
  { key: "se", label: "SE", description: "効果音" },
  { key: "bgm", label: "BGM", description: "対局BGM" },
];

const GAME_TYPE_OPTIONS: { value: GameType; label: string }[] = [
  { value: "yonma", label: "四麻" },
  { value: "sanma", label: "三麻" },
];

const LENGTH_TYPE_OPTIONS: { value: LengthType; label: string }[] = [
  { value: "tonpuusen", label: "東風戦" },
  { value: "hanchan", label: "半荘戦" },
];

export default function CreateRoomPage() {
  const router = useRouter();
  const [gameType, setGameType] = useState<GameType>("yonma");
  const [lengthType, setLengthType] = useState<LengthType>("hanchan");
  const [rules, setRules] = useState<Record<RuleKey, boolean>>({
    akaDora: true,
    kuitan: true,
    atozuke: true,
    yakitori: false,
    se: false,
    bgm: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleRule(key: RuleKey) {
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await apiFetch("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          gameType,
          lengthType,
          ...rules,
        }),
      });

      if (response.status === 401) {
        setError("ログインが必要です");
        router.push("/login");
        return;
      }

      const payload = (await response.json()) as {
        error?: string;
        room?: { roomCode: string };
      };

      if (!response.ok || !payload.room) {
        setError(payload.error ?? "部屋の作成に失敗しました");
        return;
      }

      router.push(`/rooms/${payload.room.roomCode}/lobby`);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex h-full w-full items-center justify-center px-6 py-3">
      <div className="w-full max-w-3xl">
        <div className="mb-3">
          <h1 className="text-lg font-semibold tracking-wide text-foreground">
            部屋を作成
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            人数・長さを選んでからルールを設定
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lg shadow-black/30 sm:flex-row sm:gap-6">
            <fieldset className="min-w-0 flex-1">
              <legend className="mb-2 text-xs text-muted">ゲーム</legend>
              <div className="flex gap-2" role="radiogroup" aria-label="ゲーム">
                {GAME_TYPE_OPTIONS.map((option) => {
                  const selected = gameType === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold transition ${
                        selected
                          ? "border-neutral-300 bg-neutral-100 text-neutral-900"
                          : "border-neutral-600 bg-neutral-900 text-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="gameType"
                        value={option.value}
                        checked={selected}
                        onChange={() => setGameType(option.value)}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="min-w-0 flex-1">
              <legend className="mb-2 text-xs text-muted">長さ</legend>
              <div className="flex gap-2" role="radiogroup" aria-label="長さ">
                {LENGTH_TYPE_OPTIONS.map((option) => {
                  const selected = lengthType === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold transition ${
                        selected
                          ? "border-neutral-300 bg-neutral-100 text-neutral-900"
                          : "border-neutral-600 bg-neutral-900 text-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="lengthType"
                        value={option.value}
                        checked={selected}
                        onChange={() => setLengthType(option.value)}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lg shadow-black/30 sm:flex-row sm:items-stretch">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {RULE_OPTIONS.map((option) => {
                const enabled = rules[option.key];

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleRule(option.key)}
                    aria-pressed={enabled}
                    className={`flex h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-xl border px-2 transition ${
                      enabled
                        ? "border-neutral-300 bg-neutral-100 text-neutral-900"
                        : "border-neutral-600 bg-neutral-900 text-muted"
                    }`}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span
                      className={`text-[10px] ${enabled ? "text-neutral-600" : "text-neutral-500"}`}
                    >
                      {enabled ? "ON" : "OFF"}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="h-14 shrink-0 min-w-32 self-center rounded-xl bg-neutral-100 px-5 text-sm font-semibold text-neutral-900 transition enabled:hover:bg-white disabled:opacity-50"
            >
              {submitting ? "作成中…" : "作成する"}
            </button>
          </div>
        </form>

        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
