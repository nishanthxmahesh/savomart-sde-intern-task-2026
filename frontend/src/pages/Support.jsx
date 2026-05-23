import { useEffect, useState } from 'react';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { apiErrorMessage } from '../api/client';
import { createTicket, fetchMyTickets, fetchSupportInfo } from '../api/support';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import ChatDrawer from '../components/ChatDrawer';
import ChatFab from '../components/ChatFab';
import TicketStatusBadge from '../components/TicketStatusBadge';
import TicketSuccess from '../components/TicketSuccess';
import { SkeletonBlock } from '../components/Skeleton';

const MIN_DESC = 20;
const MAX_DESC = 4000;

function ContactCard({ info, loading }) {
  if (loading || !info) {
    return <SkeletonBlock className="h-40 w-full" />;
  }
  const phoneTel = info.phone.replace(/\s|-/g, '');
  return (
    <div className="savo-card p-5 sm:p-6">
      <p className="text-xs uppercase tracking-widest font-bold text-savo-ink/45">
        Reach our team
      </p>
      <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
        <a
          href={`tel:${phoneTel}`}
          className="rounded-xl p-3 bg-savo-purple-50 border border-savo-purple-100 hover:border-savo-purple transition"
        >
          <p className="text-[11px] uppercase tracking-wide font-bold text-savo-purple/70">📞 Toll free</p>
          <p className="mt-1 font-bold text-savo-purple text-base">{info.phone}</p>
        </a>
        <a
          href={`mailto:${info.email}`}
          className="rounded-xl p-3 bg-white border border-savo-purple-100 hover:border-savo-purple transition"
        >
          <p className="text-[11px] uppercase tracking-wide font-bold text-savo-ink/45">✉ Email</p>
          <p className="mt-1 font-semibold text-savo-ink text-sm break-all">{info.email}</p>
        </a>
        <div className="rounded-xl p-3 bg-white border border-savo-purple-100/60">
          <p className="text-[11px] uppercase tracking-wide font-bold text-savo-ink/45">🕒 Hours</p>
          <p className="mt-1 font-semibold text-savo-ink text-sm">{info.hours}</p>
        </div>
      </div>
    </div>
  );
}

function TicketForm({ categories, onSubmitted }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const descLen = description.trim().length;
  const descTooShort = descLen > 0 && descLen < MIN_DESC;
  const canSubmit =
    !!category && subject.trim().length >= 3 && descLen >= MIN_DESC && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await createTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
      });
      onSubmitted(res);
    } catch (err) {
      const msg = apiErrorMessage(err);
      setError(msg);
      show(msg, { kind: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="savo-card p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="font-bold text-savo-ink">Tell us what's up</h2>
        <p className="text-sm text-savo-ink/60 mt-0.5">
          We respond to most tickets within a day. Faster for Gold members.
        </p>
      </div>

      {/* Auto-attached user identity */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-savo-ink/50 mb-1.5">
            Name
          </label>
          <div className="savo-input bg-savo-mist text-savo-ink/70 cursor-not-allowed">
            {user?.name || '—'}
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-savo-ink/50 mb-1.5">
            Mobile
          </label>
          <div className="savo-input bg-savo-mist text-savo-ink/70 cursor-not-allowed font-mono">
            +91 {user?.mobile_number || '—'}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-savo-ink/45 -mt-2">
        Auto-filled from your account — no need to type them.
      </p>

      <div>
        <label htmlFor="category" className="block text-[11px] font-bold uppercase tracking-wide text-savo-ink/50 mb-1.5">
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="savo-input"
        >
          <option value="" disabled>Pick a category…</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="subject" className="block text-[11px] font-bold uppercase tracking-wide text-savo-ink/50 mb-1.5">
          Subject
        </label>
        <input
          id="subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="One line that sums up the issue"
          className="savo-input"
          required
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="description" className="text-[11px] font-bold uppercase tracking-wide text-savo-ink/50">
            Description
          </label>
          <span
            className={`text-[11px] tabular-nums ${
              descTooShort ? 'text-red-600 font-semibold' : descLen >= MIN_DESC ? 'text-emerald-600' : 'text-savo-ink/40'
            }`}
          >
            {descLen}/{MIN_DESC} min
          </span>
        </div>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
          rows={5}
          placeholder="Tell us what happened — store, date, what you expected, what actually happened."
          className="savo-input resize-y min-h-[120px]"
          required
        />
        {descTooShort && (
          <p className="mt-1 text-xs text-red-600">
            Need at least {MIN_DESC} characters so our team has enough context.
          </p>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button type="submit" disabled={!canSubmit} className="savo-btn-primary w-full text-base">
        {submitting ? (
          <span className="inline-block w-5 h-5 border-2 border-savo-yellow/60 border-t-savo-yellow rounded-full animate-spin" />
        ) : (
          'Submit ticket'
        )}
      </button>
    </form>
  );
}

function relTime(iso) {
  const t = new Date(iso);
  const diff = Date.now() - t.getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diff / day);
  if (days <= 0) {
    const hrs = Math.floor(diff / (60 * 60 * 1000));
    if (hrs <= 0) return 'Just now';
    if (hrs === 1) return '1 hour ago';
    return `${hrs} hours ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function MyTicketsList({ tickets, loading, onSwitchToNew }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  if (!tickets.length) {
    return (
      <div className="savo-card p-8 text-center">
        <div className="text-4xl mb-2">📬</div>
        <p className="font-semibold text-savo-ink">No tickets yet.</p>
        <p className="text-sm text-savo-ink/60 mt-1">
          Submit one and it'll show up here with a status badge.
        </p>
        <button onClick={onSwitchToNew} className="mt-4 savo-btn-secondary px-4 py-2 text-sm">
          Open a ticket
        </button>
      </div>
    );
  }
  return (
    <ul className="space-y-3 animate-fade-in">
      {tickets.map((t) => (
        <li key={t.public_id} className="savo-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="font-mono text-xs font-bold text-savo-purple bg-savo-purple-50 px-1.5 py-0.5 rounded">
                  {t.public_id}
                </code>
                <TicketStatusBadge status={t.status} />
                <span className="text-[11px] text-savo-ink/45 uppercase tracking-wide font-semibold">
                  {t.category}
                </span>
              </div>
              <p className="mt-2 font-semibold text-savo-ink leading-snug">{t.subject}</p>
              <p className="mt-1 text-sm text-savo-ink/60 line-clamp-2 leading-relaxed">{t.description}</p>
            </div>
            <span className="shrink-0 text-[11px] text-savo-ink/50 whitespace-nowrap pt-1">
              {relTime(t.created_at)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Support() {
  const [tab, setTab] = useState('new'); // 'new' | 'mine'
  const [success, setSuccess] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const infoQ = useAsync(fetchSupportInfo);
  const ticketsQ = useAsync(fetchMyTickets, [tab]);

  // After creating a ticket, refresh the tickets list so 'mine' tab is fresh.
  useEffect(() => {
    if (success && tab === 'mine') ticketsQ.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success, tab]);

  const categories = infoQ.data?.categories || [];

  return (
    <div className="min-h-full bg-savo-mist">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 lg:pb-10">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-savo-ink">Help & support</h1>
          <p className="text-sm text-savo-ink/60 mt-0.5">
            We're here Mon–Sat. Pick a way to reach us.
          </p>
        </div>

        <ContactCard info={infoQ.data} loading={infoQ.loading} />

        {/* Tabs */}
        <div className="mt-6 flex rounded-xl border border-savo-purple-100 bg-white p-1 text-sm">
          {[
            { id: 'new', label: 'New ticket' },
            { id: 'mine', label: `My tickets${ticketsQ.data ? ` · ${ticketsQ.data.length}` : ''}` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id === 'mine') ticketsQ.reload();
                if (t.id === 'new') setSuccess(null);
              }}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold transition ${
                tab === t.id
                  ? 'bg-savo-purple text-savo-yellow'
                  : 'text-savo-ink/60 hover:text-savo-purple'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'new' &&
            (success ? (
              <TicketSuccess
                ticket={success.ticket}
                message={success.message}
                responseHours={success.response_time_hours}
                onNew={() => setSuccess(null)}
                onViewTickets={() => {
                  setSuccess(null);
                  setTab('mine');
                }}
              />
            ) : (
              <TicketForm categories={categories} onSubmitted={setSuccess} />
            ))}

          {tab === 'mine' && (
            <MyTicketsList
              tickets={ticketsQ.data || []}
              loading={ticketsQ.loading}
              onSwitchToNew={() => setTab('new')}
            />
          )}
        </div>
      </main>

      <BottomNav />

      <ChatFab onClick={() => setChatOpen((o) => !o)} open={chatOpen} />
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onTicketCreated={() => {
          if (tab === 'mine') ticketsQ.reload();
        }}
      />
    </div>
  );
}
