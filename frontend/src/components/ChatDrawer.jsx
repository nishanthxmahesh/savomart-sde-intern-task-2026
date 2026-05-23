import { useEffect, useMemo, useRef, useState } from 'react';
import { apiErrorMessage } from '../api/client';
import { createTicket, sendChatMessage } from '../api/support';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import { SavoAvatar, SavoBubble, TypingIndicator, UserBubble } from './ChatBubble';

const GREETING = (firstName) =>
  `Hi ${firstName} 👋 I'm Savo, your Savomart helper. What can I help with today?`;

const TICKET_TAG = /<ticket_ready>([\s\S]*?)<\/ticket_ready>/;

/** Strip the <ticket_ready> block from rendered text so the JSON doesn't leak into the bubble. */
function visibleText(content) {
  return (content || '').replace(TICKET_TAG, '').trim();
}

/** Try to parse the JSON inside a <ticket_ready> block. Returns null if absent or malformed. */
function extractTicketPayload(content) {
  const m = TICKET_TAG.exec(content || '');
  if (!m) return null;
  const raw = m[1].trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Models sometimes wrap the JSON in code fences — try one more time.
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }
}

function validateTicketPayload(p) {
  if (!p || typeof p !== 'object') return null;
  const VALID_CATS = ['Points Issue', 'Coupon Problem', 'Store Complaint', 'Delivery Issue', 'App Feedback', 'Other'];
  const description = (p.description || '').trim();
  if (description.length < 20) return null;
  const subject = (p.summary || description).trim().slice(0, 200);
  const category = VALID_CATS.includes(p.category) ? p.category : 'Other';
  return { category, subject, description };
}

export default function ChatDrawer({ open, onClose, onTicketCreated }) {
  const { user } = useAuth();
  const { show } = useToast();
  const firstName = (user?.name || '').split(' ')[0] || 'there';

  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING(firstName) },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdTicket, setCreatedTicket] = useState(null);
  const [error, setError] = useState('');

  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, sending, creating, createdTicket]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const visibleMessages = useMemo(
    () => messages.map((m) => ({ ...m, _visible: visibleText(m.content) })),
    [messages],
  );

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || sending) return;
    setError('');
    setInput('');
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const wire = nextMessages.map(({ role, content }) => ({ role, content }));
      const res = await sendChatMessage(wire);
      const assistant = { role: 'assistant', content: res.content };
      setMessages((prev) => [...prev, assistant]);

      const raw = extractTicketPayload(res.content);
      const payload = validateTicketPayload(raw);
      if (payload) {
        await autoCreateTicket(payload, [...nextMessages, assistant]);
      }
    } catch (err) {
      const msg = apiErrorMessage(err);
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const autoCreateTicket = async (payload, transcript) => {
    setCreating(true);
    try {
      const res = await createTicket({
        ...payload,
        source: 'chat',
        chat_transcript: JSON.stringify(transcript).slice(0, 19000),
      });
      setCreatedTicket(res.ticket);
      show(`Ticket ${res.ticket.public_id} created`, { kind: 'success', timeoutMs: 2400 });
      onTicketCreated?.(res.ticket);
    } catch (err) {
      const msg = apiErrorMessage(err);
      setError(`Couldn't save the ticket automatically: ${msg}`);
    } finally {
      setCreating(false);
    }
  };

  const handleNewChat = () => {
    setMessages([{ role: 'assistant', content: GREETING(firstName) }]);
    setCreatedTicket(null);
    setError('');
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label="Chat with Savo"
        className="fixed z-50 inset-x-0 bottom-0 md:inset-auto md:right-4 md:bottom-4 md:top-20 md:w-[400px] lg:right-6 lg:bottom-6 lg:top-24 bg-white md:rounded-2xl shadow-2xl border border-savo-purple-100 flex flex-col overflow-hidden animate-slide-up max-h-[88vh] md:max-h-none rounded-t-2xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-4 py-3 bg-savo-purple text-white border-b border-savo-purple-dark/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-savo-yellow text-savo-purple grid place-items-center font-extrabold">
              S
            </div>
            <div className="min-w-0">
              <p className="font-bold leading-tight">Savo</p>
              <p className="text-[11px] text-savo-yellow/85 leading-tight">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 align-middle" />
                Online · powered by Groq
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-white/10 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Messages */}
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-savo-mist"
        >
          {visibleMessages.map((m, i) => {
            if (m.role === 'user') return <UserBubble key={i} content={m.content} />;
            // Don't render an empty Savo bubble if the entire message was just the ticket_ready block
            if (!m._visible) return null;
            return <SavoBubble key={i} content={m._visible} />;
          })}

          {sending && <TypingIndicator />}

          {creating && (
            <div className="flex items-end gap-2">
              <SavoAvatar />
              <div className="px-3 py-2 rounded-xl bg-savo-purple-50 border border-savo-purple-100 text-xs text-savo-purple inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-savo-purple/40 border-t-savo-purple rounded-full animate-spin" />
                Raising your ticket…
              </div>
            </div>
          )}

          {createdTicket && (
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 animate-slide-up">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500 grid place-items-center text-white text-sm font-bold">✓</div>
                <p className="font-bold text-emerald-900">Ticket raised</p>
              </div>
              <p className="mt-1.5 text-sm text-emerald-900/85">
                Tracked as <code className="font-mono font-bold">{createdTicket.public_id}</code>.
                Our team replies within 24 hours.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleNewChat}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition"
                >
                  New chat
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={handleSend} className="border-t border-savo-purple-100 bg-white p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={createdTicket ? 'Ticket raised. Start a new chat?' : 'Type your message…'}
              disabled={sending || creating}
              rows={1}
              className="flex-1 resize-none savo-input py-2.5 max-h-32 text-sm"
              style={{ minHeight: 40 }}
            />
            <button
              type="submit"
              disabled={sending || creating || !input.trim()}
              className="savo-btn-primary w-10 h-10 p-0 shrink-0 rounded-xl"
              aria-label="Send"
            >
              {sending ? (
                <span className="inline-block w-4 h-4 border-2 border-savo-yellow/60 border-t-savo-yellow rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[10px] text-savo-ink/40 mt-1.5 text-center">
            Savo is an AI assistant. For complex issues, our human team takes over within 24h.
          </p>
        </form>
      </aside>
    </>
  );
}
