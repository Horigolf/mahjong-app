export type ScorePlayer = {
  name: string;
  score: number;
  wind: string;
  isSelf?: boolean;
  isDealer?: boolean;
};

type ScoreBoardProps = {
  players: ScorePlayer[];
  className?: string;
};

/**
 * 名前・点数・自風の一覧。
 */
export function ScoreBoard({ players, className = "" }: ScoreBoardProps) {
  return (
    <div
      className={[
        "grid gap-1.5",
        players.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
        className,
      ].join(" ")}
      aria-label="点数表示"
    >
      {players.map((player) => (
        <div
          key={`${player.wind}-${player.name}`}
          className={[
            "min-w-0 rounded-lg px-2.5 py-1.5",
            player.isSelf
              ? "bg-[#d4c4a0]/18 ring-1 ring-[#d4c4a0]/45"
              : "bg-black/25",
          ].join(" ")}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={[
                "inline-flex h-5 w-5 items-center justify-center rounded-sm text-[0.7rem] font-bold",
                player.isDealer
                  ? "bg-[#c9a227] text-[#1a2e26]"
                  : "bg-white/10 text-[#f3ead7]",
              ].join(" ")}
              style={{ fontFamily: "var(--font-game-display), serif" }}
            >
              {player.wind}
            </span>
            <span
              className="truncate text-xs text-[#f3ead7]/90"
              style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
            >
              {player.name}
              {player.isSelf ? "（自分）" : ""}
            </span>
          </div>
          <p
            className="mt-0.5 text-right text-sm font-semibold tabular-nums tracking-wide text-[#f8f1df]"
            style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
          >
            {player.score.toLocaleString("ja-JP")}
          </p>
        </div>
      ))}
    </div>
  );
}
