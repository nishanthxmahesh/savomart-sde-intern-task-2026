import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../components/Toast';
import {
  adjustAdminPoints,
  adminErrorMessage,
  bulkAdjustAdminPoints,
  fetchAdminLedger,
  fetchAdminUsers,
} from '../../api/admin';
import {
  DataTable,
  Field,
  Modal,
  PageHeader,
  Spinner,
  formatDateTime,
} from '../AdminUI';
import { SkeletonBlock } from '../../components/Skeleton';

export default function AdminPoints() {
  const { show } = useToast();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filter, setFilter] = useState({ source: '' });
  const filterKey = JSON.stringify(filter);
  const { data, loading, reload } = useAsync(() => fetchAdminLedger({ source: filter.source || undefined, limit: 200 }), [filterKey]);
  const rows = data || [];

  return (
    <div>
      <PageHeader
        title="Points"
        subtitle="Adjust customer point balances and review the full ledger."
        actions={[
          <button key="b" onClick={() => setBulkOpen(true)} className="savo-btn-secondary text-sm">Bulk adjust (CSV)</button>,
          <button key="a" onClick={() => setAdjustOpen(true)} className="savo-btn-primary text-sm">+ Adjust points</button>,
        ]}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-savo-ink/55 mr-2">Source:</span>
        {['', 'purchase', 'redemption', 'admin_adjustment', 'bonus'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter({ source: s })}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              filter.source === s ? 'bg-savo-purple text-savo-yellow border-savo-purple' : 'bg-white text-savo-ink/70 border-slate-200'
            }`}
          >
            {s || 'all'}
          </button>
        ))}
        <span className="ml-auto text-xs text-savo-ink/55">{rows.length} entries</span>
      </div>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <DataTable
          columns={[
            { header: 'When', render: (r) => <span className="text-xs whitespace-nowrap">{formatDateTime(r.created_at)}</span> },
            { header: 'Customer', render: (r) => (
              <div>
                <p className="text-sm font-semibold leading-tight">{r.customer_name}</p>
                <p className="text-[11px] text-savo-ink/55 font-mono">+91 {r.customer_mobile}</p>
              </div>
            )},
            { header: 'Δ', render: (r) => (
              <span className={`font-bold tabular-nums ${r.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {r.delta >= 0 ? '+' : ''}{r.delta}
              </span>
            )},
            { header: 'Source', render: (r) => <span className="text-[11px] uppercase tracking-wide font-semibold text-savo-ink/60">{r.source}</span> },
            { header: 'Reason', render: (r) => <span className="text-xs">{r.description}</span> },
            { header: 'By', render: (r) => r.admin_email ? (
              <span className="text-[11px] text-savo-purple font-mono">{r.admin_email}</span>
            ) : <span className="text-[11px] text-savo-ink/40">system</span> },
          ]}
          rows={rows.map((r) => ({ key: r.id, data: r }))}
          emptyText="No ledger entries match."
        />
      )}

      <AdjustModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onDone={() => { reload(); show('Adjustment applied', { kind: 'success' }); }}
      />

      <BulkAdjustModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={() => reload()}
      />
    </div>
  );
}

function AdjustModal({ open, onClose, onDone }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { data: users = [] } = useAsync(() => fetchAdminUsers(query.trim() || undefined), [query]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected) { setError('Pick a customer.'); return; }
    const n = parseInt(delta, 10);
    if (!Number.isFinite(n) || n === 0) { setError('Delta must be a non-zero integer.'); return; }
    if (!reason.trim() || reason.trim().length < 5) { setError('Reason must be at least 5 chars.'); return; }
    setError(''); setSaving(true);
    try {
      await adjustAdminPoints({ user_id: selected.id, delta: n, reason: reason.trim() });
      onDone();
      onClose();
      setSelected(null); setQuery(''); setDelta(''); setReason('');
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Adjust points" wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Customer" required hint="Search by name or mobile">
          <input
            type="search"
            value={selected ? `${selected.name} · +91 ${selected.mobile_number} · ${selected.points_balance} pts` : query}
            onChange={(e) => { setSelected(null); setQuery(e.target.value); }}
            className="savo-input"
            placeholder="Aanya or 9999999999"
            required={!selected}
          />
          {!selected && query && (
            <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
              {users.length === 0 ? <p className="text-xs text-savo-ink/55 p-3">No matches.</p> :
                users.slice(0, 8).map((u) => (
                  <button key={u.id} type="button" onClick={() => { setSelected(u); setQuery(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-savo-purple-50 border-b border-slate-100 last:border-b-0"
                  >
                    <span className="text-sm font-semibold">{u.name}</span>
                    <span className="text-xs text-savo-ink/55 ml-2 font-mono">+91 {u.mobile_number}</span>
                    <span className="text-[11px] text-savo-ink/45 ml-2">{u.tier} · {u.points_balance} pts</span>
                  </button>
                ))}
            </div>
          )}
        </Field>
        <Field label="Delta" required hint="Positive to add, negative to deduct">
          <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} className="savo-input" placeholder="e.g. 200 or -50" required />
        </Field>
        <Field label="Reason" required hint="Logged in audit trail">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="savo-input resize-y" minLength={5} maxLength={255} required placeholder="Compensation for missed points on order #1234" />
        </Field>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="savo-btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="savo-btn-primary text-sm">
            {saving ? <Spinner /> : 'Apply adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BulkAdjustModal({ open, onClose, onDone }) {
  const { show } = useToast();
  const [csv, setCsv] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // CSV format: mobile,delta,reason
  const parsed = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [mobile, delta, ...rest] = line.split(',').map((s) => s.trim());
    return { mobile_number: mobile, delta: parseInt(delta, 10), reason: rest.join(',').trim() };
  });
  const valid = parsed.filter((p) => p.mobile_number && Number.isFinite(p.delta) && p.reason.length >= 5);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setResult(null);
    if (valid.length === 0) { setError('No valid rows. Format: mobile,delta,reason (one per line).'); return; }
    setSaving(true);
    try {
      const res = await bulkAdjustAdminPoints({ entries: valid });
      setResult(res);
      show(`Applied ${res.applied} adjustments`, { kind: 'success' });
      onDone();
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bulk adjust points" wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="CSV: mobile,delta,reason" required hint="One row per line">
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={6}
            className="savo-input font-mono text-xs resize-y"
            placeholder={`9999999999,100,Compensation for slow delivery\n8888888888,200,Birthday bonus`}
            required
          />
          <p className="mt-1 text-[11px] text-savo-ink/55">
            {valid.length} valid / {parsed.length} parsed
          </p>
        </Field>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        {result && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm">
            <p className="font-semibold text-emerald-800">Applied {result.applied} / {result.total}</p>
            {result.failed?.length > 0 && (
              <p className="text-xs text-emerald-800/85 mt-1">
                Failed: {result.failed.slice(0, 5).map((f) => `${f.mobile} (${f.error})`).join('; ')}{result.failed.length > 5 ? '…' : ''}
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="savo-btn-secondary text-sm">Close</button>
          <button type="submit" disabled={saving} className="savo-btn-primary text-sm">
            {saving ? <Spinner /> : `Apply ${valid.length} adjustments`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
