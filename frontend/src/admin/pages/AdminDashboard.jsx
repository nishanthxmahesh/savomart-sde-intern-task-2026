import { useNavigate } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { fetchAdminDashboard } from '../../api/admin';
import { DataTable, PageHeader, StatCard, formatDateOnly, relTime } from '../AdminUI';
import { SkeletonBlock } from '../../components/Skeleton';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { admin, isSuperadmin } = useAdminAuth();
  const { data, loading, error, reload } = useAsync(fetchAdminDashboard);

  return (
    <div>
      <PageHeader
        title={`Hi ${admin?.name?.split(' ')[0] || 'there'} 👋`}
        subtitle={isSuperadmin ? 'You have full ops access.' : `Managing store · ${admin?.store_id || '—'}`}
        actions={[
          <button key="o" onClick={() => navigate('/admin/offers')} className="savo-btn-primary text-sm">
            + Create offer
          </button>,
          isSuperadmin && (
            <button key="c" onClick={() => navigate('/admin/coupons')} className="savo-btn-secondary text-sm">
              Issue coupon
            </button>
          ),
          <button key="t" onClick={() => navigate('/admin/tickets')} className="savo-btn-secondary text-sm">
            View tickets
          </button>,
        ].filter(Boolean)}
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-4 mb-4 text-sm">
          Couldn't load dashboard.{' '}
          <button onClick={reload} className="font-semibold underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {loading || !data ? (
          [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Total customers" value={data.total_customers} accent="purple" />
            <StatCard label="Points issued" value={data.total_points_issued.toLocaleString('en-IN')} accent="yellow" />
            <StatCard label="Active offers" value={data.active_offers} accent="ink" hint="Live in customer app" />
            <StatCard label="Open tickets" value={data.open_tickets} accent="emerald" hint="Not yet resolved" />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <section>
          <h2 className="text-base font-bold text-savo-ink mb-3">Recent signups</h2>
          {loading || !data ? (
            <SkeletonBlock className="h-40" />
          ) : (
            <DataTable
              columns={[
                { header: 'Name', render: (r) => <span className="font-semibold">{r.name}</span> },
                { header: 'Mobile', render: (r) => <span className="font-mono text-xs">+91 {r.mobile_number}</span> },
                {
                  header: 'Tier',
                  render: (r) => (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.tier === 'Gold' ? 'bg-savo-yellow-soft text-amber-900' :
                      r.tier === 'Silver' ? 'bg-slate-100 text-slate-700' :
                      'bg-amber-100 text-amber-900'
                    }`}>{r.tier}</span>
                  ),
                },
                { header: 'Pts', render: (r) => <span className="tabular-nums">{r.points_balance}</span> },
                { header: 'Joined', render: (r) => <span className="text-xs text-savo-ink/60">{formatDateOnly(r.created_at)}</span> },
              ]}
              rows={data.recent_signups}
              emptyText="No signups yet."
              onRowClick={(r) => navigate(`/admin/users/${r.id}`)}
            />
          )}
        </section>

        <section>
          <h2 className="text-base font-bold text-savo-ink mb-3">Recent tickets</h2>
          {loading || !data ? (
            <SkeletonBlock className="h-40" />
          ) : (
            <DataTable
              columns={[
                { header: 'Ticket', render: (r) => <code className="font-mono text-xs font-bold text-savo-purple bg-savo-purple-50 px-1.5 py-0.5 rounded">{r.public_id}</code> },
                { header: 'Customer', render: (r) => <span>{r.customer_name}</span> },
                { header: 'Category', render: (r) => <span className="text-xs">{r.category}</span> },
                {
                  header: 'Status',
                  render: (r) => (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                      r.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' :
                      r.status === 'in-progress' ? 'bg-sky-50 text-sky-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>{r.status}</span>
                  ),
                },
                { header: 'When', render: (r) => <span className="text-xs text-savo-ink/60">{relTime(r.created_at)}</span> },
              ]}
              rows={data.recent_tickets}
              emptyText="No tickets in the queue."
              onRowClick={(r) => navigate(`/admin/tickets/${r.public_id}`)}
            />
          )}
        </section>
      </div>
    </div>
  );
}
