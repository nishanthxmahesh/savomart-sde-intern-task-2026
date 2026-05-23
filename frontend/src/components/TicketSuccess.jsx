export default function TicketSuccess({ ticket, message, responseHours, onNew, onViewTickets }) {
  return (
    <div className="savo-card p-6 sm:p-8 text-center animate-slide-up">
      <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500 grid place-items-center savo-check-burst">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="savo-check-tick">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 className="mt-5 text-xl sm:text-2xl font-extrabold text-savo-ink">Ticket created</h2>
      <p className="mt-1 text-sm text-savo-ink/65 max-w-sm mx-auto">{message}</p>

      <div className="mt-5 inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-savo-purple-50 border border-savo-purple-100">
        <span className="text-[11px] uppercase tracking-widest font-bold text-savo-purple/70">Ticket</span>
        <code className="font-mono font-extrabold text-savo-purple tracking-wide">{ticket.public_id}</code>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-left text-sm">
        <div className="rounded-xl bg-white border border-savo-purple-100/60 p-3">
          <p className="text-[11px] uppercase tracking-wide font-bold text-savo-ink/45">Category</p>
          <p className="mt-1 font-semibold text-savo-ink">{ticket.category}</p>
        </div>
        <div className="rounded-xl bg-white border border-savo-purple-100/60 p-3">
          <p className="text-[11px] uppercase tracking-wide font-bold text-savo-ink/45">Response time</p>
          <p className="mt-1 font-semibold text-savo-ink">Within {responseHours}h</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
        <button onClick={onViewTickets} className="savo-btn-secondary text-sm">
          View my tickets
        </button>
        <button onClick={onNew} className="savo-btn-primary text-sm">
          Submit another
        </button>
      </div>
    </div>
  );
}
