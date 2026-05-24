import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useToast } from '../../components/Toast';
import { useDebounced } from '../../hooks/useDebounced';
import {
  adminErrorMessage,
  changeUserTier,
  deactivateUser,
  fetchAdminUserDetail,
  fetchAdminUsers,
  reactivateUser,
} from '../../api/admin';
import {
  ConfirmDialog,
  DataTable,
  Field,
  Modal,
  PageHeader,
  Spinner,
  formatDateOnly,
  formatDateTime,
} from '../AdminUI';
import { SkeletonBlock } from '../../components/Skeleton';
import TicketStatusBadge from '../../components/TicketStatusBadge';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q.trim(), 250);
  const { data, loading } = useAsync(() => fetchAdminUsers(debouncedQ || undefined), [debouncedQ]);
  const rows = data || [];

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Search any customer, see their full profile, adjust tier or deactivate."
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or mobile…"
          className="savo-input"
          autoFocus
        />
      </div>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <DataTable
          columns={[
            { header: 'Name', render: (u) => (
              <div className="flex items-center gap-2">
                <span className="font-semibold">{u.name}</span>
                {!u.is_active && <span className="text-[10px] uppercase font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">deactivated</span>}
              </div>
            )},
            { header: 'Mobile', render: (u) => <span className="font-mono text-xs">+91 {u.mobile_number}</span> },
            { header: 'Tier', render: (u) => (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                u.tier === 'Gold' ? 'bg-savo-yellow-soft text-amber-900' :
                u.tier === 'Silver' ? 'bg-slate-100 text-slate-700' :
                'bg-amber-100 text-amber-900'
              }`}>{u.tier}</span>
            )},
            { header: 'Points', render: (u) => <span className="tabular-nums font-semibold">{u.points_balance.toLocaleString('en-IN')}</span> },
            { header: 'Joined', render: (u) => <span className="text-xs text-savo-ink/60">{formatDateOnly(u.created_at)}</span> },
          ]}
          rows={rows.map((u) => ({ key: u.id, data: u }))}
          onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
          emptyText="No customers match."
        />
      )}
    </div>
  );
}

export function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { isSuperadmin } = useAdminAuth();
  const { show } = useToast();
  const { data: user, loading, reload } = useAsync(() => fetchAdminUserDetail(Number(userId)), [userId]);
  const [tierModal, setTierModal] = useState(false);
  const [confirmDeact, setConfirmDeact] = useState(false);

  if (loading || !user) {
    return (
      <div>
        <PageHeader title="Customer" subtitle="Loading…" />
        <SkeletonBlock className="h-64" />
      </div>
    );
  }

  const toggleActive = async () => {
    try {
      if (user.is_active) {
        await deactivateUser(user.id);
        show('Account deactivated', { kind: 'success' });
      } else {
        await reactivateUser(user.id);
        show('Account reactivated', { kind: 'success' });
      }
      setConfirmDeact(false);
      reload();
    } catch (err) {
      show(adminErrorMessage(err), { kind: 'error' });
    }
  };

  return (
    <div>
      <button onClick={() => navigate('/admin/users')} className="text-xs font-semibold text-savo-purple hover:underline mb-3">
        ← Back to customers
      </button>

      <PageHeader
        title={user.name}
        subtitle={
          <span className="font-mono text-xs">+91 {user.mobile_number}</span>
        }
        actions={isSuperadmin ? [
          <button key="t" onClick={() => setTierModal(true)} className="savo-btn-secondary text-sm">Change tier</button>,
          <button
            key="d"
            onClick={() => user.is_active ? setConfirmDeact(true) : toggleActive()}
            className={`text-sm savo-btn ${user.is_active ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
          >
            {user.is_active ? 'Deactivate' : 'Reactivate'}
          </button>,
        ] : []}
      />

      <div className="grid sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Stat label="Tier" value={user.tier} />
        <Stat label="Points" value={user.points_balance.toLocaleString('en-IN')} />
        <Stat label="Member since" value={formatDateOnly(user.created_at)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <section>
          <h2 className="text-base font-bold text-savo-ink mb-3">Recent transactions</h2>
          <DataTable
            columns={[
              { header: 'When', render: (t) => <span className="text-xs whitespace-nowrap">{formatDateTime(t.created_at)}</span> },
              { header: 'Δ', render: (t) => (
                <span className={`font-bold tabular-nums ${t.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {t.delta >= 0 ? '+' : ''}{t.delta}
                </span>
              )},
              { header: 'Reason', render: (t) => <span className="text-xs">{t.description}</span> },
            ]}
            rows={user.transactions.map((t) => ({ key: t.id, data: t }))}
            emptyText="No transactions."
          />
        </section>

        <section>
          <h2 className="text-base font-bold text-savo-ink mb-3">Active coupons</h2>
          <DataTable
            columns={[
              { header: 'Code', render: (c) => <code className="font-mono text-xs font-bold">{c.code}</code> },
              { header: 'Off', render: (c) => <span className="text-xs font-bold">{c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`}</span> },
              { header: 'Description', render: (c) => <span className="text-xs">{c.description}</span> },
              { header: 'Days left', render: (c) => <span className="text-xs tabular-nums">{c.days_remaining}</span> },
            ]}
            rows={user.coupons.map((c) => ({ key: c.id, data: c }))}
            emptyText="No active coupons."
          />
        </section>

        <section className="lg:col-span-2">
          <h2 className="text-base font-bold text-savo-ink mb-3">Tickets</h2>
          <DataTable
            columns={[
              { header: 'ID', render: (t) => <code className="font-mono text-xs font-bold text-savo-purple">{t.public_id}</code> },
              { header: 'Subject', render: (t) => <span className="text-sm font-semibold">{t.subject}</span> },
              { header: 'Category', render: (t) => <span className="text-xs">{t.category}</span> },
              { header: 'Status', render: (t) => <TicketStatusBadge status={t.status} /> },
              { header: 'When', render: (t) => <span className="text-xs text-savo-ink/60">{formatDateOnly(t.created_at)}</span> },
            ]}
            rows={user.tickets.map((t) => ({ key: t.id, data: t }))}
            onRowClick={(t) => navigate(`/admin/tickets/${t.public_id}`)}
            emptyText="No tickets raised."
          />
        </section>
      </div>

      <TierChangeModal
        open={tierModal}
        onClose={() => setTierModal(false)}
        currentTier={user.tier}
        userId={user.id}
        onChanged={() => { setTierModal(false); reload(); show('Tier updated', { kind: 'success' }); }}
      />

      <ConfirmDialog
        open={confirmDeact}
        title="Deactivate this account?"
        message={`${user.name} won't be able to log in. Their data is preserved and can be reactivated.`}
        confirmLabel="Deactivate"
        danger
        onConfirm={toggleActive}
        onCancel={() => setConfirmDeact(false)}
      />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-savo-ink/45">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}

function TierChangeModal({ open, onClose, currentTier, userId, onChanged }) {
  const [tier, setTier] = useState(currentTier);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 5) { setError('Reason must be at least 5 chars.'); return; }
    setSaving(true); setError('');
    try {
      await changeUserTier(userId, tier, reason.trim());
      onChanged();
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change tier">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New tier" required>
          <select value={tier} onChange={(e) => setTier(e.target.value)} className="savo-input">
            <option>Bronze</option>
            <option>Silver</option>
            <option>Gold</option>
          </select>
        </Field>
        <Field label="Reason" required hint="Logged in the audit trail">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="savo-input resize-y" required />
        </Field>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="savo-btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="savo-btn-primary text-sm">
            {saving ? <Spinner /> : 'Update tier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
