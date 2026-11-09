import type { ButtonHTMLAttributes } from "react";
import { cx, splitPath } from "../format.ts";
import { post } from "../state/vscode.ts";

export function Icon({ name, className, spin }: { name: string; className?: string; spin?: boolean }) {
  return <span aria-hidden="true" className={cx("codicon", `codicon-${name}`, spin && "codicon-modifier-spin", className)} />;
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
}

export function IconButton({ icon, label, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "grid size-6 shrink-0 place-items-center rounded text-fg hover:bg-hover disabled:hover:bg-transparent",
        className,
      )}
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
      className={cx("flex min-w-0 rounded-sm text-left hover:underline decoration-muted underline-offset-2", className)}
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

export function Dot({ className, pulse }: { className: string; pulse?: boolean }) {
  return <span aria-hidden="true" className={cx("inline-block size-2 shrink-0 rounded-full", pulse && "animate-pulse-soft", className)} />;
}
