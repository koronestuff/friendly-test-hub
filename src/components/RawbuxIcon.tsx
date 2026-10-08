export function RawbuxIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M5.6 2.4 21.6 6.7 17.3 22.7 1.3 18.4 5.6 2.4Z"
        fill="currentColor"
      />
      <path d="M9.6 9.4 14.9 10.8 13.5 16.1 8.2 14.7 9.6 9.4Z" fill="var(--color-card)" />
    </svg>
  );
}

export function Price({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${className}`}>
      <RawbuxIcon />
      {amount.toLocaleString("en-US")}
    </span>
  );
}
