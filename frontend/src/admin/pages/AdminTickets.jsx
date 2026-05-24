import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useToast } from '../../components/Toast';
import {
  adminErrorMessage,
  fetchAdminTicket,
  fetchAdminTickets,
  patchAdminTicket,
} from '../../api/admin';
import {
  DataTable,
  Field,
  PageHeader,
  Spinner,
  formatDateTime,
  relTime,
} from '../AdminUI';
import { SkeletonBlock } from '../../components/Skeleton';
import TicketStatusBadge from '../../components/TicketStatusBadge';

export default function AdminTickets() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState({ status: '', category: '' });
  const filterKey = JSON.stringify(filter);
  const { data, loading } = useAsync(
    () => fetchAdminTickets({
      status: filter.status || undefined,
      category: filter.category || undefined,
      limit: 200,
    }),
    [filterKey],
  );
  const rows = data || [];

  return (
    <div>
      <PageHeader
        title="Support tickets"
        subtitle="Triage, assign, and resolve customer tickets."
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-savo-ink/55 mr-1">Status:</span>
        {['', 'open', 'in-progress', 'resolved'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter({ ...filter, status: s })}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              filter.status === s ? 'bg-savo-purple text-savo-yellow border-savo-purple' : 'bg-white text-savo-ink/70 border-slate-200'
            }`}
          >
            {s || 'all'}
          </button>
        ))}
        <span className="ml-auto text-xs text-savo-ink/55">{rows.length} tickets</span>
      </div>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <DataTable
          columns={[
            { header: 'ID', render: (t) => <code className="font-mono text-xs font-bold text-savo-purple bg-savo-purple-50 px-1.5 py-0.5 rounded">{t.public_id}</code> },
            { header: 'Customer', render: (t) => (
              <div>
                <p className="text-sm font-semibold leading-tight">{t.customer_name}</p>
                <p className="text-[11px] text-savo-ink/55 font-mono">+91 {t.customer_mobile}</p>
              </div>
            )},
            { header: 'Subject', render: (t) => (
              <div className="max-w-xs">
                <p className="text-sm font-semibold leading-tight line-clamp-1">{t.subject}</p>
                <p className="text-[11px] text-savo-ink/55">{t.category} · via {t.source}</p>
              </div>
            )},
            { header: 'Status', render: (t) => <TicketStatusBadge status={t.status} /> },
            { header: 'Assigned to', render: (t) => t.assigned_to_admin_email ? (
              <span className="text-xs text-savo-purple">{t.assigned_to_admin_email}</span>
            ) : <span className="text-xs text-savo-ink/40">unassigned</span> },
            { header: 'When', render: (t) => <span className="text-xs text-savo-ink/60">{relTime(t.created_at)}</span> },
          ]}
          rows={rows.map((t) => ({ key: t.public_id, data: t }))}
          onRowClick={(t) => navigate(`/admin/tickets/${t.public_id}`)}
          emptyText="Inbox zero."
        />
      )}
    </div>
  );
}

export function AdminTicketDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { isSuperadmin } = useAdminAuth();
  const { show } = useToast();
  const { data: ticket, loading, reload } = useAsync(() => fetchAdminTicket(publicId), [publicId]);

  const [form, setForm] = useState({ status: '', internal_notes: '', response_sent: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Sync form from loaded ticket
  if (ticket && !form.status) {
    setForm({
      status: ticket.status,
      internal_notes: ticket.internal_notes || '',
      response_sent: ticket.response_sent || '',
    });
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        status: form.status,
        internal_notes: form.internal_notes,
        response_sent: form.response_sent,
      };
      await patchAdminTicket(publicId, payload);
      show('Ticket updated', { kind: 'success' });
      reload();
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !ticket) {
    return (
      <div>
        <PageHeader title="Ticket" subtitle="Loading…" />
        <SkeletonBlock className="h-64" />
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => navigate('/admin/tickets')} className="text-xs font-semibold text-savo-purple hover:underline mb-3">
        ← Back to tickets
      </button>

      <PageHeader
        title={ticket.subject}
        subtitle={
          <span>
            <code className="font-mono text-xs font-bold text-savo-purple bg-savo-purple-50 px-1.5 py-0.5 rounded mr-2">{ticket.public_id}</code>
            · {ticket.category} · via {ticket.source}
          </span>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4">
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-savo-ink/65 uppercase tracking-wide mb-2">Description</h2>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </section>

          {ticket.chat_transcript && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-savo-ink/65 uppercase tracking-wide mb-2">Chat transcript</h2>
              <ChatTranscript raw={ticket.chat_transcript} />
            </section>
          )}

          <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-savo-ink/65 uppercase tracking-wide">Triage</h2>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="savo-input">
                <option value="open">Open</option>
                <option value="in-progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </Field>
            <Field label="Internal notes" hint="Admin-only — customer never sees this">
              <textarea
                value={form.internal_notes}
                onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
                rows={3}
                maxLength={4000}
                className="savo-input resize-y"
                placeholder="What you found, who you spoke to, next steps…"
              />
            </Field>
            <Field label="Response sent" hint="What was communicated back to the customer">
              <textarea
                value={form.response_sent}
                onChange={(e) => setForm({ ...form, response_sent: e.target.value })}
                rows={3}
                maxLength={4000}
                className="savo-input resize-y"
                placeholder="We've credited 60 points to your account. Sorry for the trouble!"
              />
            </Field>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="savo-btn-primary text-sm">
                {saving ? <Spinner /> : 'Save changes'}
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-savo-ink/65 uppercase tracking-wide mb-3">Customer</h2>
            <p className="font-semibold">{ticket.customer_name}</p>
            <p className="text-xs text-savo-ink/55 font-mono">+91 {ticket.customer_mobile}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-savo-mist p-2">
                <p className="text-[10px] uppercase tracking-wide text-savo-ink/45 font-bold">Tier</p>
                <p className="font-bold mt-0.5">{ticket.customer_tier}</p>
              </div>
              <div className="rounded-lg bg-savo-mist p-2">
                <p className="text-[10px] uppercase tracking-wide text-savo-ink/45 font-bold">Points</p>
                <p className="font-bold mt-0.5">{ticket.customer_points}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/admin/users/${ticket.user_id}`)}
              className="mt-3 w-full savo-btn-secondary text-xs"
            >
              View full profile →
            </button>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-savo-ink/65 uppercase tracking-wide mb-3">Status</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-savo-ink/55">Created</span>
                <span>{formatDateTime(ticket.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-savo-ink/55">Resolved</span>
                <span>{formatDateTime(ticket.resolved_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-savo-ink/55">Assigned to</span>
                <span className="text-savo-purple text-right truncate ml-2">
                  {ticket.assigned_to_admin_email || 'unassigned'}
                </span>
              </div>
            </div>
            {!isSuperadmin && (
              <p className="mt-3 text-[11px] text-savo-ink/45 italic">
                Re-assignment is superadmin-only.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function ChatTranscript({ raw }) {
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return <pre className="text-xs whitespace-pre-wrap text-savo-ink/65">{raw}</pre>;
  }
  if (!Array.isArray(parsed)) {
    return <pre className="text-xs whitespace-pre-wrap text-savo-ink/65">{raw}</pre>;
  }
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {parsed.map((m, i) => (
        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap leading-relaxed ${
            m.role === 'user' ? 'bg-savo-purple text-white rounded-br-md' : 'bg-savo-purple-50 text-savo-ink rounded-bl-md'
          }`}>
            {(m.content || '').replace(/<ticket_ready>[\s\S]*?<\/ticket_ready>/g, '').trim() || <em className="opacity-60">(empty)</em>}
          </div>
        </div>
      ))}
    </div>
  );
}
