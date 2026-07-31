/**
 * iOS Safari 向け「ホーム画面に追加」案内。
 */
export function AddToHomeScreenTip({ className = "" }: { className?: string }) {
  return (
    <aside
      className={[
        "rounded-xl border border-neutral-700/80 bg-neutral-900/70 px-3 py-2 text-left text-[0.7rem] leading-relaxed text-muted",
        className,
      ].join(" ")}
    >
      <p className="font-medium text-foreground/90">
        ホーム画面に追加すると全画面で快適に遊べます
      </p>
      <p className="mt-1">
        iPhone（Safari）: 共有ボタン →「ホーム画面に追加」→「追加」
      </p>
      <p className="mt-1">
        追加後は下の「対局画面プレビュー」を開くと、フルスクリーンの卓を確認できます。
      </p>
    </aside>
  );
}
