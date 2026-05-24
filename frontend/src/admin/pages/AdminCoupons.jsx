import { useMemo, useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../components/Toast';
import {
  adminErrorMessage,
  bulkIssueAdminCoupons,
  fetchAdminCoupons,
  fetchAdminUsers,
  issueAdminCoupon,
} from '../../api/admin';
import {
  DataTable,
  Field,
  Modal,
  PageHeader,
  Spinner,
  formatDateOnly,
} from '../AdminUI';
import { SkeletonBlock } from '../../components/Skeleton';

export default function AdminCoupons() {
  const { show } = useToast();
  const [filters, setFilters] = useState({ used: undefined, expired: false });
  const filterKey = JSON.stringify(filters);
  const { data, loading, reload } = useAsync(() => fetchAdminCoupons(filters), [filterKey]);

  const [issueOpen, setIssueOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const rows = data || [];

  return (
    <div>
      <PageHeader
        title="Coupons"
        subtitle="Issue and track customer coupons."
        actions={[
          <button key="b" onClick={() => setBulkOpen(true)} className="savo-btn-secondary text-sm">Bulk issue (CSV)</button>,
          <button key="i" onClick={() => setIssueOpen(true)} className="savo-btn-primary text-sm">+ Issue coupon</button>,
        ]}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
        <FilterPill
          active={filters.used === undefined}
          onClick={() => setFilters({ ...filters, used: undefined })}
          label="All"
        />
        <FilterPill
          active={filters.used === false}
          onClick={() => setFilters({ ...filters, used: false })}
          label="Unused"
        />
        <FilterPill
          active={filters.used === true}
          onClick={() => setFilters({ ...filters, used: true })}
          label="Used"
        />
        <span className="mx-2 text-savo-ink/30">·</span>
        <FilterPill
          active={filters.expired === false}
          onClick={() => setFilters({ ...filters, expired: false })}
          label="Active (not expired)"
        />
        <FilterPill
          active={filters.expired === true}
          onClick={() => setFilters({ ...filters, expired: true })}
          label="Expired"
        />
        <span className="ml-auto text-xs text-savo-ink/55">{rows.length} rows</span>
      </div>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <DataTable
          columns={[
            { header: 'Code', render: (c) => <code className="font-mono text-xs font-bold">{c.code}</code> },
            { header: 'Customer', render: (c) => (
              <div>
                <p className="text-sm font-semibold leading-tight">{c.customer_name}</p>
                <p className="text-[11px] text-savo-ink/55 font-mono">+91 {c.customer_mobile}</p>
              </div>
            )},
            { header: 'Discount', render: (c) => (
              <span className="text-xs font-bold text-savo-purple">
                {c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`} off
              </span>
            )},
            { header: 'Description', render: (c) => <span className="text-xs">{c.description}</span> },
            { header: 'Expiry', render: (c) => <span className="text-xs">{formatDateOnly(c.expires_at)}</span> },
            { header: 'Scope', render: (c) => c.applicable_store_id ? (
              <span className="text-[11px] text-savo-purple">📍 {c.applicable_store_id}</span>
            ) : <span className="text-[11px] text-emerald-700">All</span> },
            { header: 'Status', render: (c) => {
              const expired = new Date(c.expires_at) < new Date();
              if (c.is_used) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">Used</span>;
              if (expired) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Expired</span>;
              return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Active</span>;
            }},
          ]}
          rows={rows.map((c) => ({ key: c.id, data: c }))}
          emptyText="No coupons match these filters."
        />
      )}

      <IssueCouponModal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        onIssued={() => { reload(); show('Coupon issued', { kind: 'success' }); }}
      />

      <BulkIssueModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={() => { reload(); }}
      />
    </div>
  );
}

function FilterPill({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
        active ? 'bg-savo-purple text-savo-yellow border-savo-purple' : 'bg-white text-savo-ink/70 border-slate-200 hover:border-savo-purple'
      }`}
    >
      {label}
    </button>
  );
}

function IssueCouponModal({ open, onClose, onIssued }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    code: '', discount_value: 50, discount_type: 'flat',
    description: '', expires_in_days: 30, applicable_store_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { data: users = [] } = useAsync(() => fetchAdminUsers(query.trim() || undefined), [query]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected) { setError('Pick a customer first.'); return; }
    if (!form.description.trim()) { setError('Description required.'); return; }
    setError('');
    setSaving(true);
    try {
      await issueAdminCoupon({
        user_id: selected.id,
        code: form.code.trim() || undefined,
        discount_value: Number(form.discount_value),
        discount_type: form.discount_type,
        description: form.description.trim(),
        expires_in_days: Number(form.expires_in_days),
        applicable_store_id: form.applicable_store_id.trim() || null,
      });
      onIssued();
      onClose();
      setSelected(null); setForm({ ...form, description: '', code: '' }); setQuery('');
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Issue coupon" wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Customer" required hint="Search by name or mobile">
          <input
            type="search"
            value={selected ? `${selected.name} · +91 ${selected.mobile_number}` : query}
            onChange={(e) => { setSelected(null); setQuery(e.target.value); }}
            placeholder="e.g. Aanya or 9999"
            className="savo-input"
            required={!selected}
          />
          {!selected && query && (
            <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
              {users.length === 0 ? (
                <p className="text-xs text-savo-ink/55 p-3">No matches.</p>
              ) : users.slice(0, 8).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setSelected(u); setQuery(''); }}
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
        <Field label="Code (optional)" hint="Auto-generates SAVO-XXXX if blank">
          <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="savo-input font-mono" maxLength={40} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Discount type" required>
            <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="savo-input">
              <option value="flat">Flat ₹ off</option>
              <option value="percent">Percent off</option>
            </select>
          </Field>
          <Field label="Discount value" required>
            <input type="number" min={1} max={10000} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} className="savo-input" required />
          </Field>
        </div>
        <Field label="Description" required>
          <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="savo-input" maxLength={255} required />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Expires in (days)" required>
            <input type="number" min={1} max={365} value={form.expires_in_days} onChange={(e) => setForm({ ...form, expires_in_days: e.target.value })} className="savo-input" />
          </Field>
          <Field label="Applicable store id" hint="Blank = all stores">
            <input type="text" value={form.applicable_store_id} onChange={(e) => setForm({ ...form, applicable_store_id: e.target.value })} className="savo-input" />
          </Field>
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="savo-btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="savo-btn-primary text-sm">
            {saving ? <Spinner /> : 'Issue coupon'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BulkIssueModal({ open, onClose, onDone }) {
  const { show } = useToast();
  const [csv, setCsv] = useState('');
  const [form, setForm] = useState({
    code_prefix: 'BULK', discount_value: 50, discount_type: 'flat',
    description: '', expires_in_days: 30, applicable_store_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const mobiles = useMemo(
    () => csv.split(/\r?\n|,/).map((m) => m.trim()).filter(Boolean),
    [csv],
  );

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setResult(null);
    if (!mobiles.length) { setError('Paste at least one mobile number.'); return; }
    if (!form.description.trim()) { setError('Description required.'); return; }
    setSaving(true);
    try {
      const res = await bulkIssueAdminCoupons({
        mobile_numbers: mobiles,
        code_prefix: form.code_prefix.trim(),
        discount_value: Number(form.discount_value),
        discount_type: form.discount_type,
        description: form.description.trim(),
        expires_in_days: Number(form.expires_in_days),
        applicable_store_id: form.applicable_store_id.trim() || null,
      });
      setResult(res);
      show(`Issued ${res.issued} coupons`, { kind: 'success' });
      onDone();
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bulk issue coupons" wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Mobile numbers" required hint="One per line OR comma-separated">
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={5}
            className="savo-input font-mono text-sm resize-y"
            placeholder={`9999999999\n8888888888\n7777777777`}
            required
          />
          <p className="mt-1 text-[11px] text-savo-ink/55">
            {mobiles.length} number{mobiles.length === 1 ? '' : 's'} parsed
          </p>
        </Field>
        <Field label="Code prefix" hint="Each coupon will get its own SUFFIX">
          <input type="text" value={form.code_prefix} onChange={(e) => setForm({ ...form, code_prefix: e.target.value.toUpperCase() })} className="savo-input font-mono" maxLength={20} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Discount type" required>
            <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="savo-input">
              <option value="flat">Flat ₹ off</option>
              <option value="percent">Percent off</option>
            </select>
          </Field>
          <Field label="Discount value" required>
            <input type="number" min={1} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} className="savo-input" required />
          </Field>
        </div>
        <Field label="Description" required>
          <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="savo-input" required />
        </Field>
        <Field label="Expires in (days)" required>
          <input type="number" min={1} max={365} value={form.expires_in_days} onChange={(e) => setForm({ ...form, expires_in_days: e.target.value })} className="savo-input" />
        </Field>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        {result && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm">
            <p className="font-semibold text-emerald-800">Issued {result.issued} / {result.total_requested}</p>
            {result.missing_mobiles?.length > 0 && (
              <p className="text-xs text-emerald-800/85 mt-1">
                Skipped (not customers): {result.missing_mobiles.slice(0, 5).join(', ')}{result.missing_mobiles.length > 5 ? '…' : ''}
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="savo-btn-secondary text-sm">Close</button>
          <button type="submit" disabled={saving} className="savo-btn-primary text-sm">
            {saving ? <Spinner /> : `Issue to ${mobiles.length}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
