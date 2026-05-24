import { useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { fetchCoupons, fetchProfile, fetchTransactions } from '../api/profile';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import PointsCard from '../components/PointsCard';
import TierBadge from '../components/TierBadge';
import CouponCard from '../components/CouponCard';
import TransactionRow from '../components/TransactionRow';
import { SkeletonBlock, SkeletonText } from '../components/Skeleton';

function QuickAction({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white border border-savo-purple-100/60 hover:border-savo-purple hover:bg-savo-purple-50 transition group"
    >
      <span className="w-10 h-10 rounded-xl bg-savo-purple-50 group-hover:bg-savo-purple text-savo-purple group-hover:text-savo-yellow grid place-items-center transition">
        {icon}
      </span>
      <span className="text-xs font-semibold text-savo-ink">{label}</span>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const profileQ = useAsync(fetchProfile);
  const couponsQ = useAsync(fetchCoupons);
  const txnsQ = useAsync(() => fetchTransactions(8));

  const profile = profileQ.data;
  const coupons = couponsQ.data || [];
  const txns = txnsQ.data || [];

  const firstName = (profile?.name || '').split(' ')[0] || 'there';

  return (
    <div className="min-h-full bg-savo-mist">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 lg:pb-10">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left / main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Greeting */}
            <div className="flex items-center justify-between gap-3 animate-fade-in">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-savo-ink">
                  Hi {firstName} <span className="inline-block">👋</span>
                </h1>
                <p className="text-sm text-savo-ink/60 mt-0.5">
                  Welcome back. Here's your loyalty snapshot.
                </p>
              </div>
              {profile && <TierBadge tier={profile.tier} />}
            </div>

            {/* Points card */}
            {profileQ.loading || !profile ? (
              <SkeletonBlock className="h-44 w-full" />
            ) : (
              <PointsCard
                balance={profile.points_balance}
                tier={profile.tier}
                nextTier={profile.next_tier}
                pointsToNext={profile.points_to_next_tier}
                progressPct={profile.tier_progress_percent}
              />
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3">
              <QuickAction
                label="Offers"
                onClick={() => navigate('/offers')}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                }
              />
              <QuickAction
                label="Stores"
                onClick={() => navigate('/stores')}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                }
              />
              <QuickAction
                label="Help"
                onClick={() => navigate('/support')}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                }
              />
            </div>

            {/* Coupons */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-savo-ink">Your coupons</h2>
                <span className="text-xs text-savo-ink/50">
                  {coupons.length} active
                </span>
              </div>
              {couponsQ.loading ? (
                <div className="flex gap-3 overflow-hidden">
                  {[0, 1].map((i) => (
                    <SkeletonBlock key={i} className="h-40 w-72 shrink-0" />
                  ))}
                </div>
              ) : coupons.length === 0 ? (
                <div className="savo-card p-6 text-center text-sm text-savo-ink/60">
                  No active coupons right now. Browse{' '}
                  <button
                    onClick={() => navigate('/offers')}
                    className="text-savo-purple font-semibold hover:underline"
                  >
                    offers
                  </button>{' '}
                  to earn new ones.
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto savo-scroll-x pb-2 -mx-4 px-4 snap-x snap-mandatory">
                  {coupons.map((c) => (
                    <div key={c.id} className="snap-start">
                      <CouponCard coupon={c} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right column (transactions + profile sidebar on desktop) */}
          <aside className="space-y-6">
            <section className="savo-card p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-savo-ink">Recent activity</h2>
              </div>
              {txnsQ.loading ? (
                <div className="space-y-3 mt-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <SkeletonBlock className="w-9 h-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <SkeletonText width="w-3/4" />
                        <SkeletonText width="w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : txns.length === 0 ? (
                <p className="text-sm text-savo-ink/60 mt-2">No activity yet.</p>
              ) : (
                <ul className="mt-1">
                  {txns.map((t) => (
                    <TransactionRow key={t.id} txn={t} />
                  ))}
                </ul>
              )}
            </section>

            {profile && (
              <section className="savo-card p-5">
                <h2 className="text-base font-bold text-savo-ink mb-3">Profile</h2>
                <dl className="text-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <dt className="text-savo-ink/55">Name</dt>
                    <dd className="font-semibold">{profile.name}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-savo-ink/55">Mobile</dt>
                    <dd className="font-mono">+91 {profile.mobile_number}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-savo-ink/55">Member since</dt>
                    <dd className="font-semibold">
                      {new Date(profile.member_since).toLocaleDateString('en-IN', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </dd>
                  </div>
                </dl>
              </section>
            )}
          </aside>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
