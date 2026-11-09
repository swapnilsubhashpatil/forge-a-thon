import { AnvilMark } from "./AnvilMark.tsx";

const examples = [
  "Explain how this project is structured",
  "Find where errors are handled and summarise the approach",
  "Add a test for the function I have open",
];

const inlineShortcut = navigator.userAgent.includes("Mac") ? "⌘⌥K" : "Ctrl+Alt+K";

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-lg border border-border bg-editor">
        <AnvilMark className="size-7 text-fg" />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-fg">Anvil</h1>
        <p className="mt-1 max-w-72 text-sm text-muted">
          Describe a change. Anvil finds the right code, edits across files, and shows every diff before it lands.
        </p>
      </div>
      <ul className="flex w-full max-w-80 flex-col gap-1.5">
        {examples.map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => onPick(example)}
              className="w-full rounded border border-border px-3 py-1.5 text-left text-sm text-fg hover:border-focus hover:bg-hover"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        <kbd className="rounded-sm border border-border px-1 font-mono text-2xs">{inlineShortcut}</kbd> edits the selection inline
      </p>
    </div>
  );
}
