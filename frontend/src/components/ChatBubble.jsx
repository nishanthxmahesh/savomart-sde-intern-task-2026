export function SavoAvatar({ className = '' }) {
  return (
    <div
      className={`shrink-0 w-7 h-7 rounded-full bg-savo-purple text-savo-yellow grid place-items-center font-extrabold text-xs ${className}`}
      aria-hidden
    >
      S
    </div>
  );
}

export function UserBubble({ content }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] px-3.5 py-2 rounded-2xl rounded-br-md bg-savo-purple text-white text-sm leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </div>
    </div>
  );
}

export function SavoBubble({ content, children }) {
  return (
    <div className="flex items-end gap-2">
      <SavoAvatar />
      <div className="max-w-[78%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-savo-purple-50 text-savo-ink text-sm leading-relaxed whitespace-pre-wrap break-words border border-savo-purple-100/70">
        {content}
        {children}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <SavoAvatar />
      <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-savo-purple-50 border border-savo-purple-100/70">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-1.5 h-1.5 rounded-full bg-savo-purple/60 savo-typing-dot"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
