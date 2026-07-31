/**
 * Portrait 時のみ全画面で横向き案内を表示する（対局画面専用）。
 * Tailwind の `portrait:` は `@media (orientation: portrait)` に対応する。
 */
export function OrientationGuard() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999] hidden flex-col items-center justify-center gap-3 bg-neutral-950 px-6 text-center text-neutral-100 portrait:pointer-events-auto portrait:flex"
      role="alert"
      aria-live="polite"
    >
      <p className="text-lg font-medium tracking-wide">横画面にしてください</p>
      <p className="max-w-xs text-sm text-neutral-400">
        対局中はスマートフォンを横画面にしてください
      </p>
    </div>
  );
}
