import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx, splitPath } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon, type GlyphName } from "./Glyph.tsx";

export { Icon };

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: GlyphName;
  label: string;
}

export function IconButton({ icon, label, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx("btn btn-icon", className)}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

export const inputClass = "h-7 w-full rounded-md border border-input-border bg-input px-2 text-xs text-input-fg outline-none placeholder:text-muted focus:border-focus";

export function Switch({ on, label, title, onChange }: { on: boolean; label: string; title?: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      onClick={() => onChange(!on)}
      className={cx("relative h-4 w-7 shrink-0 rounded-full border transition-colors", on ? "border-focus bg-focus" : "border-border bg-editor")}
    >
      <span className={cx("absolute top-0.5 size-2.5 rounded-full bg-fg transition-[left]", on ? "left-3.5" : "left-0.5")} />
    </button>
  );
}

export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: Array<{ value: T; label: string; title?: string }>; value: T; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-border bg-editor/40 p-0.5 text-xs">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cx("h-6 min-w-0 flex-1 rounded-md font-medium", value === option.value ? "bg-raised text-fg shadow-sm" : "text-muted hover:text-fg")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
      {error && <span className="text-xs text-red">{error}</span>}
    </label>
  );
}

export function ListToolbar({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <div className="flex min-h-6 items-center gap-1">
      <p className="min-w-0 flex-1 text-xs text-muted">{summary}</p>
      {children}
    </div>
  );
}

export function PathText({ path, className }: { path: string; className?: string }) {
  const { dir, base } = splitPath(path);
  return (
    <span className={cx("min-w-0 truncate", className)}>
      <span className="text-muted">{dir}</span>
      <span className="text-fg">{base}</span>
    </span>
  );
}

export function PathLink({ path, line, className }: { path: string; line?: number; className?: string }) {
  return (
    <button
      type="button"
      title={`Open ${path}`}
      onClick={(event) => {
        event.stopPropagation();
        post({ type: "openFile", path, line });
      }}
      className={cx("flex min-w-0 rounded-sm text-left decoration-muted underline-offset-2 hover:underline", className)}
    >
      <PathText path={path} />
    </button>
  );
}

export function DiffStat({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="shrink-0 font-mono text-xs tabular-nums" aria-label={`${added} added, ${removed} removed`}>
      <span className="text-added">+{added}</span> <span className="text-removed">−{removed}</span>
    </span>
  );
}

export type StatusKind = "ready" | "pending" | "offline" | "cooling" | "unknown";

const statusTone: Record<StatusKind, string> = {
  ready: "text-green",
  pending: "text-yellow",
  offline: "text-red",
  cooling: "text-yellow",
  unknown: "text-muted",
};

function pie(fraction: number): string {
  if (fraction >= 1) return "M6 3.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5Z";
  const angle = 2 * Math.PI * Math.max(fraction, 0.05);
  const x = 6 + 2.5 * Math.sin(angle);
  const y = 6 - 2.5 * Math.cos(angle);
  return `M6 6V3.5A2.5 2.5 0 ${fraction > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
}

export function StatusGlyph({ kind, fraction = 0.5, size = 12, className }: { kind: StatusKind; fraction?: number; size?: number; className?: string }) {
  const mask = useId();
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} aria-hidden="true" className={cx("shrink-0", statusTone[kind], className)}>
      {kind === "ready" ? (
        <>
          <mask id={mask}>
            <circle cx="6" cy="6" r="6" fill="white" />
            <path d="m3.6 6.2 1.6 1.6 3.2-3.3" fill="none" stroke="black" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </mask>
          <circle cx="6" cy="6" r="5.5" fill="currentColor" mask={`url(#${mask})`} />
        </>
      ) : (
        <circle cx="6" cy="6" r="4.9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray={kind === "unknown" ? "2 1.85" : undefined} />
      )}
      {(kind === "pending" || kind === "cooling") && <path d={pie(fraction)} fill="currentColor" />}
      {kind === "offline" && <path d="M3.2 8.8 8.8 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />}
    </svg>
  );
}
