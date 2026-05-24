import { useCountUp } from '../hooks/useCountUp';

export default function PointsCard({ balance, tier, nextTier, pointsToNext, progressPct }) {
  const displayed = useCountUp(balance ?? 0, 1200);
  const isMaxTier = !nextTier;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-savo-purple text-white shadow-savo-glow p-5 sm:p-6">
      <div
        className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-savo-yellow/10 blur-2xl pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-savo-yellow/5 blur-2xl pointer-events-none"
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-savo-yellow/80 text-xs font-bold uppercase tracking-widest">
            Loyalty points
          </p>
          <p className="text-white/60 text-xs font-medium">{tier} member</p>
        </div>

        <div className="mt-3 flex items-baseline gap-2 flex-wrap">
          <span className="text-4xl sm:text-5xl font-extrabold text-savo-yellow tabular-nums leading-none">
            {displayed.toLocaleString('en-IN')}
          </span>
          <span className="text-white/70 font-semibold text-sm">pts</span>
        </div>

        <div className="mt-5">
          {isMaxTier ? (
            <p className="text-sm text-savo-yellow font-medium">
              ✨ You're our top-tier shopper. Enjoy every Gold perk.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-white/80">
                  <span className="font-semibold text-savo-yellow">
                    {pointsToNext?.toLocaleString('en-IN')}
                  </span>{' '}
                  pts to <span className="font-semibold text-savo-yellow">{nextTier}</span>
                </span>
                <span className="text-white/60">{progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-savo-yellow rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressPct ?? 0}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
