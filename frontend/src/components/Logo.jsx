export default function Logo({ size = 'md', wordmark = true }) {
  const dim = size === 'sm' ? 28 : size === 'lg' ? 56 : 40;
  return (
    <div className="inline-flex items-center gap-2">
      <div
        className="rounded-xl bg-savo-purple flex items-center justify-center shadow-savo-glow"
        style={{ width: dim, height: dim }}
        aria-label="Savomart logo"
      >
        <span
          className="font-extrabold text-savo-yellow"
          style={{ fontSize: dim * 0.55, lineHeight: 1 }}
        >
          S
        </span>
      </div>
      {wordmark && (
        <span className="font-extrabold text-savo-purple tracking-tight" style={{ fontSize: dim * 0.5 }}>
          SAVO<span className="text-savo-ink/70">mart</span>
        </span>
      )}
    </div>
  );
}
