import { useId, type ButtonHTMLAttributes } from "react";
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
