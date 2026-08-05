type ScreenshotPlaceholderProps = {
  label: string;
  hint?: string;
  aspect?: "video" | "square" | "tall" | "phone";
  className?: string;
};

const aspectClasses: Record<NonNullable<ScreenshotPlaceholderProps["aspect"]>, string> = {
  video: "aspect-[16/10]",
  square: "aspect-square",
  tall: "aspect-[4/5]",
  phone: "aspect-[9/16]",
};

/**
 * Stand-in for a real product screenshot. Swap by dropping the named file
 * into /public/screenshots/ and rendering an <Image> in its place — the
 * `label` here is the exact screen this slot expects (see the screenshot
 * checklist), so it doubles as a manifest while the real assets land.
 */
export default function ScreenshotPlaceholder({
  label,
  hint,
  aspect = "video",
  className = "",
}: ScreenshotPlaceholderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-df-lg border-2 border-dashed border-border bg-[#eef4f8] p-6 text-center ${aspectClasses[aspect]} ${className}`}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-muted" aria-hidden="true">
        <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 15l4.5-4.5a1.5 1.5 0 0 1 2.12 0L14 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <p className="text-sm font-semibold text-navy">{label}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
