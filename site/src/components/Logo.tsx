export const ANVIL_PATH = 'M2 5.5h20V8a2 2 0 0 1-2 2h-3l-1.5 3v2.5l3.5 2.5v2H6v-2l3.5-2.5V13L8 10C5.5 7.4 3.6 6 2 5.5Z'
export const SPARK_PATH = 'M15 .5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z'

export default function Logo({ className = 'h-6 w-6', accent = '#f97316' }: { className?: string; accent?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={ANVIL_PATH} />
      <path d={SPARK_PATH} fill={accent} />
    </svg>
  )
}
