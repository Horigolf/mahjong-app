"use client";

export type ActionTone = "call" | "win" | "riichi" | "skip";

export type ActionItem = {
  id: string;
  label: string;
  tone?: ActionTone;
};

const TONE_CLASS: Record<ActionTone, string> = {
  call: "border-[#7dd3b0]/50 bg-[#14523f] text-[#e8fff5] hover:bg-[#1a6a51]",
  win: "border-[#f0b7a0]/55 bg-[#8b2e1f] text-[#fff1eb] hover:bg-[#a33826]",
  riichi:
    "border-[#e8d48a]/55 bg-[#7a5a12] text-[#fff8df] hover:bg-[#926c16]",
  skip: "border-white/25 bg-black/35 text-[#f3ead7]/90 hover:bg-black/50",
};

type ActionButtonsProps = {
  actions: ActionItem[];
  className?: string;
  onAction?: (actionId: string) => void;
  hint?: string | null;
};

/**
 * 可能なアクションだけ表示。
 */
export function ActionButtons({
  actions,
  className = "",
  onAction,
  hint,
}: ActionButtonsProps) {
  if (actions.length === 0 && !hint) {
    return null;
  }

  return (
    <div
      className={[
        "flex flex-row flex-wrap items-center justify-center gap-2",
        className,
      ].join(" ")}
      aria-label="アクション"
    >
      {hint ? (
        <p
          className="w-full text-center text-[0.6rem] text-[#d4c4a0]/90"
          style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
        >
          {hint}
        </p>
      ) : null}
      {actions.map((action) => {
        const tone = action.tone ?? "skip";
        return (
          <button
            key={action.id}
            type="button"
            className={[
              "w-full min-w-0 rounded-full border px-2 py-1 text-center text-[0.65rem] font-semibold tracking-wider shadow-md shadow-black/30 transition",
              TONE_CLASS[tone],
            ].join(" ")}
            style={{ fontFamily: "var(--font-game-ui), sans-serif" }}
            onClick={() => onAction?.(action.id)}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
