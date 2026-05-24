import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAsync } from '../../hooks/useAsync';
import { fetchAdminAnalytics } from '../../api/admin';
import { PageHeader } from '../AdminUI';
import { SkeletonBlock } from '../../components/Skeleton';

const PURPLE = '#782B90';
const YELLOW = '#FFF200';
const TIER_COLORS = { Bronze: '#B45309', Silver: '#64748B', Gold: '#F59E0B' };

export default function AdminAnalytics() {
  const { data, loading, error, reload } = useAsync(fetchAdminAnalytics);

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Loading charts…" />
        <div className="grid lg:grid-cols-2 gap-4">
          {[0,1,2,3,4].map((i) => <SkeletonBlock key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-4 text-sm">
          Couldn't load analytics. <button onClick={reload} className="font-semibold underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Snapshot of customer, loyalty, and support trends."
      />

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard title="Points issued vs redeemed (this month)">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.points_issued_vs_redeemed}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {data.points_issued_vs_redeemed.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? PURPLE : '#F59E0B'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tier distribution">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.tier_distribution}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.tier_distribution.map((d) => (
                  <Cell key={d.label} fill={TIER_COLORS[d.label] || PURPLE} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top offer categories (active)">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.top_offer_categories} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="label" fontSize={11} width={110} />
              <Tooltip />
              <Bar dataKey="value" fill={PURPLE} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ticket volume by category">
          {data.ticket_volume_by_category.length === 0 ? (
            <EmptyChart message="No tickets in the system yet." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.ticket_volume_by_category}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" fontSize={11} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="New signups — last 30 days" colSpanFull>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.signups_last_30_days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                fontSize={10}
                tickFormatter={(s) => s.slice(5)}
                interval={2}
              />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke={PURPLE}
                strokeWidth={2.5}
                dot={{ r: 3, fill: YELLOW, stroke: PURPLE, strokeWidth: 1.5 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children, colSpanFull = false }) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200 p-4 ${colSpanFull ? 'lg:col-span-2' : ''}`}>
      <h3 className="text-sm font-bold text-savo-ink/65 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </section>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="h-[250px] grid place-items-center text-sm text-savo-ink/45">
      {message}
    </div>
  );
}
