import { useState } from 'react';
import { useToast } from './Toast';

function formatDiscount(type, value) {
  if (type === 'percent') return `${value}% OFF`;
  return `₹${value} OFF`;
}

export default function CouponCard({ coupon }) {
  const { show } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      show(`Copied ${coupon.code}`, { kind: 'success', timeoutMs: 2000 });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      show('Could not copy. Long-press to copy manually.', { kind: 'error' });
    }
  };

  const expiringSoon = coupon.days_remaining <= 3;

  return (
    <div className="relative shrink-0 w-72 rounded-2xl bg-white border border-dashed border-savo-purple/40 shadow-savo-card overflow-hidden">
      <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-savo-mist border border-dashed border-savo-purple/40" />
      <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-5 rounded-full bg-savo-mist border border-dashed border-savo-purple/40" />
      <div className="p-4 pl-5 pr-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-savo-ink/50 uppercase tracking-widest font-bold">Coupon</p>
            <p className="mt-0.5 text-2xl font-extrabold text-savo-purple leading-tight">
              {formatDiscount(coupon.discount_type, coupon.discount_value)}
            </p>
          </div>
          {expiringSoon && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
              {coupon.days_remaining === 0 ? 'Last day' : `${coupon.days_remaining}d left`}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-savo-ink/70 line-clamp-2 min-h-[2.5rem]">
          {coupon.description}
        </p>
        <div className="mt-3 border-t border-dashed border-savo-purple/30 pt-3 flex items-center justify-between gap-2">
          <code className="font-mono text-sm font-bold text-savo-ink tracking-wide truncate">
            {coupon.code}
          </code>
          <button
            onClick={handleCopy}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
              copied
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-savo-purple text-savo-yellow hover:bg-savo-purple-dark'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        {!expiringSoon && (
          <p className="mt-2 text-[11px] text-savo-ink/40">
            Expires in {coupon.days_remaining} days
          </p>
        )}
      </div>
    </div>
  );
}
