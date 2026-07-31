/**
 * 牌 SVG 素材のクレジット（CC0 / public domain）。
 */
export function TileAttribution({ className = "" }: { className?: string }) {
  return (
    <p
      className={[
        "text-[0.65rem] leading-relaxed text-muted/80",
        className,
      ].join(" ")}
    >
      牌画像:{" "}
      <a
        href="https://github.com/FluffyStuff/riichi-mahjong-tiles"
        target="_blank"
        rel="noreferrer"
        className="underline decoration-neutral-600 underline-offset-2 hover:text-foreground"
      >
        FluffyStuff/riichi-mahjong-tiles
      </a>
      （CC0 / public domain）
    </p>
  );
}
