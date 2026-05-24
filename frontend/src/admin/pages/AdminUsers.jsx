import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useToast } from '../../components/Toast';
import { useDebounced } from '../../hooks/useDebounced';
import {
  adminErrorMessage,
  changeUserTier,
  createAdminCustomer,
  deactivateUser,
  downloadImportTemplate,
  fetchAdminUserDetail,
  fetchAdminUsers,
  importCustomersExcel,
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
  const { isSuperadmin } = useAdminAuth();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q.trim(), 250);
  const { data, loading, reload } = useAsync(() => fetchAdminUsers(debouncedQ || undefined), [debouncedQ]);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const rows = data || [];

  const headerActions = [
    <button key="new" onClick={() => setCreateOpen(true)} className="savo-btn-primary text-sm">
      + Enroll customer
    </button>,
  ];
  if (isSuperadmin) {
    headerActions.unshift(
      <button key="imp" onClick={() => setImportOpen(true)} className="savo-btn-secondary text-sm">
        ⬆ Import Excel
      </button>,
    );
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Enroll new customers, search existing ones, adjust tier or deactivate."
        actions={headerActions}
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

      <CreateCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(u) => { setCreateOpen(false); reload(); navigate(`/admin/users/${u.id}`); }}
      />
      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => { reload(); }}
      />
    </div>
  );
}

function ImportExcelModal({ open, onClose, onDone }) {
  const { show } = useToast();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const reset = () => { setFile(null); setResult(null); setError(''); };
  const close = () => { reset(); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await importCustomersExcel(file);
      setResult(res);
      if (res.header_errors?.length) {
        setError(res.header_errors.join(' '));
      } else {
        show(
          `Imported ${res.success_count} row${res.success_count === 1 ? '' : 's'} — ` +
          `${res.created_users} new, ${res.updated_users} updated, ${res.points_awarded_total.toLocaleString('en-IN')} pts awarded`,
          { kind: 'success' },
        );
        onDone();
      }
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Import customers from Excel">
      {!result ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="text-sm text-savo-ink/70 leading-relaxed">
            Upload an <code className="font-mono text-xs bg-savo-purple-50 px-1 py-0.5 rounded">.xlsx</code> with
            customer activity. Loyalty points are awarded automatically using this rule:
          </div>
          <div className="rounded-xl bg-savo-yellow-soft border border-amber-200 p-3 text-xs leading-relaxed">
            <p className="font-bold text-amber-900 mb-1">Loyalty rules engine</p>
            <ul className="list-disc pl-4 space-y-0.5 text-amber-900/90">
              <li>Every <strong>₹10 spent = 1 point</strong> (floor division)</li>
              <li><code className="font-mono">coupon_code</code> column marks that coupon as used on the matching customer</li>
              <li>Unknown mobile numbers <strong>auto-create a new Bronze customer</strong> with the provided name</li>
              <li>Tier is recomputed from the new balance — Bronze 0–999, Silver 1,000–4,999, Gold 5,000+</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-bold text-slate-800 mb-1">Required columns (case-insensitive)</p>
            <p className="font-mono text-[11px]">name, mobile, amount_spent, coupon_code, description</p>
            <p className="text-slate-600 mt-1">
              Only <strong>name</strong> and <strong>mobile</strong> are required. Others can be blank.
            </p>
            <button
              type="button"
              onClick={downloadImportTemplate}
              className="mt-2 text-xs font-semibold text-savo-purple hover:underline"
            >
              ⬇ Download sample template
            </button>
          </div>
          <Field label="Excel file" required>
            <input
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-savo-purple file:text-white hover:file:bg-savo-purple-dark cursor-pointer"
              required
            />
          </Field>
          {file && (
            <div className="text-xs text-savo-ink/70">
              Selected: <span className="font-mono">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="savo-btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={!file || busy} className="savo-btn-primary text-sm">
              {busy ? <Spinner /> : 'Import & award points'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <ImportStat label="Total rows" value={result.total_rows} />
            <ImportStat label="New users" value={result.created_users} accent="emerald" />
            <ImportStat label="Updated" value={result.updated_users} accent="purple" />
            <ImportStat label="Points awarded" value={result.points_awarded_total.toLocaleString('en-IN')} accent="yellow" />
            <ImportStat label="Coupons used" value={result.coupons_redeemed_total} accent="purple" />
          </div>

          {result.errors?.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs">
              <p className="font-bold text-red-800 mb-2">{result.errors.length} row(s) had issues</p>
              <ul className="space-y-1 max-h-40 overflow-auto pr-1">
                {result.errors.slice(0, 25).map((e, i) => (
                  <li key={i} className="text-red-900/90">
                    <span className="font-mono">row {e.row}</span>
                    {e.mobile && <> · <span className="font-mono">{e.mobile}</span></>}
                    {' — '}{e.error}
                  </li>
                ))}
                {result.errors.length > 25 && (
                  <li className="text-red-700 italic">…and {result.errors.length - 25} more</li>
                )}
              </ul>
            </div>
          )}

          {result.outcomes?.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs max-h-48 overflow-auto">
              <p className="font-bold text-slate-800 mb-2">Applied rows</p>
              <table className="w-full text-xs">
                <thead className="text-savo-ink/55 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left pb-1">Row</th>
                    <th className="text-left pb-1">Customer</th>
                    <th className="text-right pb-1">+pts</th>
                    <th className="text-left pb-1">Coupon</th>
                  </tr>
                </thead>
                <tbody>
                  {result.outcomes.slice(0, 50).map((o, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1 font-mono">{o.row}</td>
                      <td className="py-1">
                        {o.name}
                        {o.created && <span className="ml-1 text-[10px] font-bold text-emerald-700">NEW</span>}
                        <span className="ml-1 text-savo-ink/40 font-mono">+91 {o.mobile}</span>
                      </td>
                      <td className="py-1 text-right tabular-nums font-bold text-emerald-700">
                        {o.points_awarded > 0 ? `+${o.points_awarded}` : '—'}
                      </td>
                      <td className="py-1 font-mono text-xs">{o.coupon_redeemed || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.outcomes.length > 50 && (
                <p className="text-[11px] text-savo-ink/50 italic mt-1">…and {result.outcomes.length - 50} more</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className="savo-btn-secondary text-sm">Import another</button>
            <button type="button" onClick={close} className="savo-btn-primary text-sm">Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ImportStat({ label, value, accent = 'slate' }) {
  const ring = {
    emerald: 'border-emerald-200 bg-emerald-50',
    purple: 'border-savo-purple-100 bg-savo-purple-50',
    yellow: 'border-amber-200 bg-savo-yellow-soft',
    slate: 'border-slate-200 bg-slate-50',
  }[accent] || 'border-slate-200 bg-slate-50';
  return (
    <div className={`rounded-xl border ${ring} p-2.5`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-savo-ink/55">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function CreateCustomerModal({ open, onClose, onCreated }) {
  const { show } = useToast();
  const [form, setForm] = useState({ name: '', mobile_number: '', initial_points: 0, tier: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const created = await createAdminCustomer({
        name: form.name.trim(),
        mobile_number: form.mobile_number.trim(),
        initial_points: Number(form.initial_points) || 0,
        tier: form.tier || null,
      });
      show(`Enrolled ${created.name}`, { kind: 'success' });
      setForm({ name: '', mobile_number: '', initial_points: 0, tier: '' });
      onCreated(created);
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Enroll new customer">
      <p className="text-xs text-savo-ink/55 mb-4">
        Since customer self-signup is disabled, every new Savomart customer is enrolled by an admin
        here. The mobile they provide will be what they sign in with via OTP.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="savo-input"
            maxLength={120}
            required
            autoFocus
          />
        </Field>
        <Field label="Mobile (10 digits)" required hint="Without +91">
          <input
            type="tel"
            inputMode="numeric"
            value={form.mobile_number}
            onChange={(e) => setForm({ ...form, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            className="savo-input font-mono"
            placeholder="9876543210"
            required
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Initial points" hint="Welcome bonus, if any">
            <input
              type="number"
              min={0}
              max={100000}
              value={form.initial_points}
              onChange={(e) => setForm({ ...form, initial_points: e.target.value })}
              className="savo-input"
            />
          </Field>
          <Field label="Tier" hint="Blank = auto from points">
            <select
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value })}
              className="savo-input"
            >
              <option value="">Auto</option>
              <option value="Bronze">Bronze</option>
              <option value="Silver">Silver</option>
              <option value="Gold">Gold</option>
            </select>
          </Field>
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="savo-btn-secondary text-sm">Cancel</button>
          <button
            type="submit"
            disabled={saving || form.name.trim().length < 2 || form.mobile_number.length !== 10}
            className="savo-btn-primary text-sm"
          >
            {saving ? <Spinner /> : 'Enroll customer'}
          </button>
        </div>
      </form>
    </Modal>
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
