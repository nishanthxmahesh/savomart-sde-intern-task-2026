import { useEffect, useMemo, useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useToast } from '../../components/Toast';
import { fetchStores } from '../../api/stores';
import {
  adminErrorMessage,
  createAdminOffer,
  deleteAdminOffer,
  duplicateAdminOffer,
  fetchAdminOffers,
  updateAdminOffer,
} from '../../api/admin';
import {
  ConfirmDialog,
  DataTable,
  Field,
  Modal,
  PageHeader,
  Spinner,
  formatDateOnly,
} from '../AdminUI';
import { SkeletonBlock } from '../../components/Skeleton';

const CATEGORIES = [
  'Fresh Produce', 'Dairy & Eggs', 'Bakery', 'Snacks', 'Beverages',
  'Breakfast', 'Staples', 'Frozen', 'Personal Care', 'Home Essentials',
  'Loyalty', 'Delivery', 'Referral', 'Sitewide', 'Other',
];

const blank = () => ({
  title: '',
  description: '',
  discount_label: '',
  category: 'Sitewide',
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  store_scope: 'all',
  store_id: '',
  store_name: '',
  tier_required: '',
});

function classifyStatus(o) {
  const now = new Date();
  const from = new Date(o.valid_from);
  const until = new Date(o.valid_until);
  if (until < now) return { label: 'Expired', cls: 'bg-slate-100 text-slate-600' };
  if (from > now) return { label: 'Scheduled', cls: 'bg-sky-50 text-sky-700' };
  return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700' };
}

export default function AdminOffers() {
  const { isSuperadmin, admin } = useAdminAuth();
  const { show } = useToast();
  const { data, loading, reload } = useAsync(fetchAdminOffers);
  const stores = useAsync(fetchStores);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');

  const offers = data || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) =>
      `${o.title} ${o.category} ${o.store_name || ''}`.toLowerCase().includes(q),
    );
  }, [offers, search]);

  const openCreate = () => {
    setEditing(null);
    const init = blank();
    // Pre-fill for store managers — they can ONLY create for their store
    if (!isSuperadmin && admin?.store_id) {
      init.store_scope = 'specific';
      init.store_id = admin.store_id;
      const match = (stores.data?.items || []).find((s) => s.id === admin.store_id);
      init.store_name = match?.name || '';
    }
    setForm(init);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (o) => {
    setEditing(o);
    setForm({
      title: o.title,
      description: o.description,
      discount_label: o.discount_label,
      category: o.category,
      valid_from: o.valid_from?.slice(0, 10),
      valid_until: o.valid_until?.slice(0, 10),
      store_scope: o.store_scope,
      store_id: o.store_id || '',
      store_name: o.store_name || '',
      tier_required: o.tier_required || '',
    });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        discount_label: form.discount_label.trim(),
        category: form.category,
        valid_from: new Date(form.valid_from + 'T00:00:00Z').toISOString(),
        valid_until: new Date(form.valid_until + 'T23:59:59Z').toISOString(),
        store_scope: form.store_scope,
        store_id: form.store_scope === 'specific' ? form.store_id || null : null,
        store_name: form.store_scope === 'specific' ? form.store_name || null : null,
        tier_required: form.tier_required || null,
      };
      if (editing) {
        await updateAdminOffer(editing.id, payload);
        show('Offer updated', { kind: 'success' });
      } else {
        await createAdminOffer(payload);
        show('Offer created', { kind: 'success' });
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (o) => {
    try {
      await duplicateAdminOffer(o.id);
      show('Duplicated', { kind: 'success' });
      reload();
    } catch (err) {
      show(adminErrorMessage(err), { kind: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAdminOffer(deleteId);
      show('Offer deleted', { kind: 'success' });
      setDeleteId(null);
      reload();
    } catch (err) {
      show(adminErrorMessage(err), { kind: 'error' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle={
          isSuperadmin
            ? 'Manage every offer across all stores.'
            : `Edit your store's offers. Sitewide offers are read-only.`
        }
        actions={[
          <button key="new" onClick={openCreate} className="savo-btn-primary text-sm">
            + Create offer
          </button>,
        ]}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, category, or store…"
          className="savo-input"
        />
        <span className="text-xs text-savo-ink/55 whitespace-nowrap">
          {filtered.length} / {offers.length}
        </span>
      </div>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <DataTable
          columns={[
            { header: 'Title', render: (o) => (
              <div>
                <p className="font-semibold leading-tight">{o.title}</p>
                <p className="text-[11px] text-savo-ink/55 line-clamp-1">{o.description}</p>
              </div>
            )},
            { header: 'Category', render: (o) => <span className="text-xs">{o.category}</span> },
            { header: 'Discount', render: (o) => (
              <span className="text-xs font-bold text-savo-purple bg-savo-purple-50 px-2 py-0.5 rounded-full">
                {o.discount_label}
              </span>
            )},
            { header: 'Scope', render: (o) => (
              o.store_scope === 'specific'
                ? <span className="text-xs text-savo-purple">📍 {o.store_name || o.store_id}</span>
                : <span className="text-xs text-emerald-700">All stores</span>
            )},
            { header: 'Tier', render: (o) => o.tier_required ? (
              <span className="text-[11px] font-semibold">{o.tier_required}+</span>
            ) : <span className="text-[11px] text-savo-ink/40">—</span> },
            { header: 'Valid', render: (o) => (
              <span className="text-[11px] text-savo-ink/65 whitespace-nowrap">
                {formatDateOnly(o.valid_from)} → {formatDateOnly(o.valid_until)}
              </span>
            )},
            { header: 'Status', render: (o) => {
              const s = classifyStatus(o);
              return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${s.cls}`}>{s.label}</span>;
            }},
            { header: '', render: (o) => (
              <div className="flex gap-1 text-xs justify-end" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(o)} className="px-2 py-1 rounded hover:bg-slate-100 text-savo-purple font-semibold">Edit</button>
                <button onClick={() => duplicate(o)} className="px-2 py-1 rounded hover:bg-slate-100 text-savo-ink/65 font-semibold">Copy</button>
                <button onClick={() => setDeleteId(o.id)} className="px-2 py-1 rounded hover:bg-red-50 text-red-600 font-semibold">Delete</button>
              </div>
            )},
          ]}
          rows={filtered.map((o) => ({ key: o.id, data: o }))}
          emptyText="No offers match."
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit offer' : 'Create offer'} wide>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Title" required>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="savo-input" maxLength={160} required />
          </Field>
          <Field label="Description" required>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="savo-input resize-y" maxLength={2000} required />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Category" required>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="savo-input">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Discount label" required hint="e.g. 10% OFF, ₹50 OFF">
              <input type="text" value={form.discount_label} onChange={(e) => setForm({ ...form, discount_label: e.target.value })} className="savo-input" maxLength={40} required />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Valid from" required>
              <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className="savo-input" required />
            </Field>
            <Field label="Valid until" required>
              <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="savo-input" required />
            </Field>
          </div>
          <Field label="Store scope" required>
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" value="all" checked={form.store_scope === 'all'} onChange={() => setForm({ ...form, store_scope: 'all' })} disabled={!isSuperadmin} />
                All stores {!isSuperadmin && <span className="text-[10px] text-savo-ink/40">(superadmin only)</span>}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="specific" checked={form.store_scope === 'specific'} onChange={() => setForm({ ...form, store_scope: 'specific' })} />
                Specific store
              </label>
            </div>
          </Field>
          {form.store_scope === 'specific' && (
            <Field label="Store" required>
              <select
                value={form.store_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const s = (stores.data?.items || []).find((x) => x.id === id);
                  setForm({ ...form, store_id: id, store_name: s?.name || '' });
                }}
                className="savo-input"
                disabled={!isSuperadmin}
                required
              >
                <option value="" disabled>Pick a store…</option>
                {(stores.data?.items || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Tier required" hint="Optional. Customers below this tier won't see it.">
            <select value={form.tier_required} onChange={(e) => setForm({ ...form, tier_required: e.target.value })} className="savo-input">
              <option value="">All tiers</option>
              <option value="Bronze">Bronze+</option>
              <option value="Silver">Silver+</option>
              <option value="Gold">Gold only</option>
            </select>
          </Field>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="savo-btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="savo-btn-primary text-sm">
              {saving ? <Spinner /> : editing ? 'Save changes' : 'Create offer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete this offer?"
        message="The offer will be removed immediately. Customers won't see it again."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
