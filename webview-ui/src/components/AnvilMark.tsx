export function AnvilMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M2 6h15c2.8 0 5 1.6 5 3.6 0 .3-.2.4-.5.4H18c-1.1 0-2 .9-2 2v1.2c0 .9.6 1.7 1.4 1.9l.6.2V18H6v-2.7l.6-.2c.8-.2 1.4-1 1.4-1.9V12c0-1.1-.9-2-2-2H4.5C3.1 10 2 8.9 2 7.5V6Z" />
      <rect x="4" y="19" width="16" height="2" rx="0.5" />
    </svg>
  );
}
