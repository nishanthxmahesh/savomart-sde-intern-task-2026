const CATEGORY_ICONS = {
  'Fresh Produce': '🥬',
  'Dairy & Eggs': '🥛',
  Bakery: '🥐',
  Snacks: '🍿',
  Beverages: '🥤',
  Breakfast: '🥣',
  Staples: '🌾',
  Frozen: '🧊',
  'Personal Care': '🧴',
  'Home Essentials': '🧺',
  Loyalty: '⭐',
  Delivery: '🚚',
  Referral: '🤝',
  Sitewide: '🛒',
  Sweets: '🍬',
};

function formatExpiry(daysRemaining) {
  if (daysRemaining === 0) return 'Last day';
  if (daysRemaining === 1) return '1 day left';
  if (daysRemaining < 30) return `${daysRemaining} days left`;
  const weeks = Math.round(daysRemaining / 7);
  return `${weeks} weeks left`;
}

export default function OfferCard({ offer }) {
  const expiring = offer.days_remaining <= 3;
  const tierLocked = offer.tier_required && !offer.is_eligible;
  const icon = CATEGORY_ICONS[offer.category] || '🏷️';

  return (
    <article
      className={`relative savo-card p-4 sm:p-5 flex gap-3 sm:gap-4 transition hover:shadow-savo-glow hover:-translate-y-0.5 ${
        tierLocked ? 'opacity-70' : ''
      }`}
    >
      <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-savo-purple-50 grid place-items-center text-2xl sm:text-3xl">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-savo-ink leading-snug">{offer.title}</h3>
          <span className="shrink-0 inline-flex items-center px-2 py-1 rounded-full bg-savo-purple text-savo-yellow text-[11px] font-bold uppercase tracking-wide whitespace-nowrap">
            {offer.discount_label}
          </span>
        </div>

        <p className="mt-1 text-sm text-savo-ink/65 leading-relaxed line-clamp-2">
          {offer.description}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <span className="px-2 py-0.5 rounded-full bg-savo-mist text-savo-ink/70 border border-savo-purple-100/70">
            {offer.category}
          </span>
          {offer.store_scope === 'specific' ? (
            <span className="px-2 py-0.5 rounded-full bg-savo-purple-50 text-savo-purple border border-savo-purple-100">
              📍 {offer.store_name || 'Selected store'}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              All stores
            </span>
          )}
          {offer.tier_required && (
            <span
              className={`px-2 py-0.5 rounded-full border ${
                tierLocked
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-savo-yellow-soft text-amber-900 border-savo-yellow'
              }`}
            >
              {offer.tier_required}+ only
            </span>
          )}
          <span
            className={`ml-auto px-2 py-0.5 rounded-full border ${
              expiring
                ? 'bg-red-50 text-red-700 border-red-100'
                : 'bg-white text-savo-ink/55 border-savo-purple-100/60'
            }`}
          >
            {expiring && <span className="mr-0.5">⏰</span>}
            {formatExpiry(offer.days_remaining)}
          </span>
        </div>
      </div>

      {tierLocked && (
        <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          Locked
        </div>
      )}
    </article>
  );
}
