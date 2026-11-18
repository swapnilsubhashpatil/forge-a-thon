export default function Logo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <path d="M3 7h13.5c0 2.2 1.8 3.5 4.5 3.5V12c-3 0-5 1.2-5.6 3.2H8.6C8 13.2 6 12 3 12z" />
      <path d="M8.5 15.2 7 19h10l-1.5-3.8" />
      <path d="M5.5 21h13" />
    </svg>
  )
}
