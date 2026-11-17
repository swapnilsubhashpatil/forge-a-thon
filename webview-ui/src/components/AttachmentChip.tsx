import type { Attachment } from "../../../src/shared/protocol.ts";
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

function Preview({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === "image") return <img src={attachment.dataUrl} alt="" className="size-6 rounded-sm object-cover" />;
  return <Icon name={attachment.kind === "terminal" ? "terminal" : "code"} className="text-muted" />;
}

export function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const source = attachment.kind === "selection" && attachment.path;
  const lines = attachment.kind === "image" ? undefined : attachment.text.split(/\r?\n/).length;
  return (
    <li className="flex items-center gap-1 rounded border border-border bg-badge/30 px-1.5 py-0.5 text-xs text-fg" title={attachment.text.slice(0, 600) || attachment.label}>
      <Preview attachment={attachment} />
      {source ? (
        <button type="button" title={`Open ${attachment.path}`} onClick={() => post({ type: "openFile", path: source, line: attachment.startLine })} className="font-mono hover:underline">
          {attachment.label}
        </button>
      ) : (
        <span className="max-w-32 truncate font-mono">{attachment.label}</span>
      )}
      {lines !== undefined && <span className="font-mono text-muted">{lines} lines</span>}
      <button type="button" aria-label={`Remove ${attachment.label}`} onClick={onRemove} className="grid size-4 place-items-center rounded text-muted hover:bg-hover hover:text-fg">
        <Icon name="close" size={12} />
      </button>
    </li>
  );
}
