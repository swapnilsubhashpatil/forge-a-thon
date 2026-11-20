import type { ReactNode } from "react";
import type { Attachment, EditorSelection } from "../../../src/shared/protocol.ts";
import { cx, splitPath } from "../format.ts";
import { post } from "../state/vscode.ts";
import { Icon } from "./primitives.tsx";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function readImages(files: File[], room: number): Promise<{ images: Attachment[]; error?: string }> {
  const candidates = files.filter((file) => IMAGE_TYPES.includes(file.type));
  const small = candidates.filter((file) => file.size <= MAX_IMAGE_BYTES);
  const taken = small.slice(0, Math.max(0, room));
  const errors = [
    small.length < candidates.length && "Images over 4 MB were skipped.",
    taken.length < small.length && `Up to ${MAX_IMAGES} images per message.`,
  ].filter(Boolean);
  const stamp = Date.now();
  const images = await Promise.all(
    taken.map(async (file, index): Promise<Attachment> => ({
      id: `image-${stamp}-${index}`,
      kind: "image",
      label: file.name || "pasted image",
      text: "",
      dataUrl: await readDataUrl(file),
      mime: file.type,
    })),
  );
  return { images, error: errors.join(" ") || undefined };
}

const tool = "flex h-5 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-hover hover:text-fg";

function lineRange(start?: number, end?: number): string | undefined {
  if (start === undefined) return undefined;
  return end === undefined || end === start ? `${start}` : `${start}–${end}`;
}

export function mentionParts(value: string): { path: string; label: string; detail?: string; symbol: boolean } {
  const hash = value.indexOf("#");
  const path = hash < 0 ? value : value.slice(0, hash);
  const { dir, base } = splitPath(path);
  if (hash >= 0) return { path, label: value.slice(hash + 1), detail: base, symbol: true };
  return { path, label: base, detail: dir.replace(/\/$/, "") || undefined, symbol: false };
}

interface ChipProps {
  lead: ReactNode;
  label: string;
  detail?: string;
  title?: string;
  open?: { path: string; line?: number };
  live?: boolean;
  removeLabel: string;
  onRemove: () => void;
  children?: ReactNode;
}

function Chip({ lead, label, detail, title, open, live, removeLabel, onRemove, children }: ChipProps) {
  const text = (
    <>
      <span className="max-w-40 min-w-0 truncate font-mono text-fg">{label}</span>
      {detail && <span className="max-w-28 min-w-0 truncate text-muted">{detail}</span>}
    </>
  );
  return (
    <li
      title={title}
      className={cx(
        "group flex h-6 max-w-full min-w-0 items-center gap-1 rounded-md border bg-raised pr-0.5 pl-1.5 text-xs",
        live ? "border-dashed border-muted/50" : "border-border",
      )}
    >
      {lead}
      {open ? (
        <button
          type="button"
          title={`Open ${open.path}`}
          onClick={() => post({ type: "openFile", ...open })}
          className="flex min-w-0 items-center gap-1 rounded-sm decoration-muted underline-offset-2 hover:underline"
        >
          {text}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-1">{text}</span>
      )}
      {children}
      <button
        type="button"
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
        className={cx(tool, "w-0 overflow-hidden group-focus-within:w-5 group-hover:w-5")}
      >
        <Icon name="close" size={12} />
      </button>
    </li>
  );
}

export function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const { kind, path, label } = attachment;
  const lead =
    kind === "image" ? (
      <img src={attachment.dataUrl} alt="" className="size-4 shrink-0 rounded-sm object-cover" />
    ) : (
      <Icon name={kind === "terminal" ? "terminal" : "code"} className="text-muted" />
    );
  return (
    <Chip
      lead={lead}
      label={kind === "terminal" ? attachment.command ?? label : path ? splitPath(path).base : label}
      detail={
        kind === "selection"
          ? lineRange(attachment.startLine, attachment.endLine)
          : attachment.exitCode !== undefined
            ? `exit ${attachment.exitCode}`
            : undefined
      }
      title={attachment.text.slice(0, 600) || label}
      open={kind === "selection" && path ? { path, line: attachment.startLine } : undefined}
      removeLabel={`Remove ${label}`}
      onRemove={onRemove}
    />
  );
}

export function MentionChip({ value, onRemove }: { value: string; onRemove: () => void }) {
  const { path, label, detail, symbol } = mentionParts(value);
  return (
    <Chip
      lead={<Icon name={symbol ? "symbol" : "file"} className={symbol ? "text-purple" : "text-muted"} />}
      label={label}
      detail={detail}
      title={value}
      open={{ path }}
      removeLabel={`Remove ${label}`}
      onRemove={onRemove}
    />
  );
}

export function SkillChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <Chip
      lead={<Icon name="book" className="text-purple" />}
      label={`/${name}`}
      title={`Use the ${name} skill`}
      removeLabel={`Remove /${name}`}
      onRemove={onRemove}
    />
  );
}

export function LiveSelectionChip({ selection }: { selection: EditorSelection }) {
  return (
    <Chip
      live
      lead={<Icon name="eye" className="text-blue" />}
      label={splitPath(selection.path).base}
      detail={lineRange(selection.startLine, selection.endLine)}
      title="Your current editor selection. It is sent with your next message; pin it to keep it while you select elsewhere."
      open={{ path: selection.path, line: selection.startLine }}
      removeLabel="Do not send this selection"
      onRemove={() => post({ type: "dismissSelection" })}
    >
      <button
        type="button"
        aria-label={`Pin ${selection.label}`}
        title="Pin, then select more code to add several"
        onClick={() => post({ type: "pinSelection" })}
        className={cx(tool, "w-5")}
      >
        <Icon name="pin" size={12} />
      </button>
    </Chip>
  );
}
