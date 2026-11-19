export function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, "") : Math.round(thousands)}k`;
}

export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export function splitPath(path: string): { dir: string; base: string } {
  const slash = path.lastIndexOf("/");
  return { dir: path.slice(0, slash + 1), base: path.slice(slash + 1) };
}

export function shortModel(model: string): string {
  return model.slice(model.lastIndexOf("/") + 1);
}

export function cx(...classes: Array<string | false | undefined | null>): string {
  return classes.filter(Boolean).join(" ");
}

export function toolBaseName(name: string): string {
  return name.split(/__|\./).pop() ?? name;
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function relativeTime(at: number): string {
  const minutes = Math.round((at - Date.now()) / 60_000);
  if (minutes > -60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}
