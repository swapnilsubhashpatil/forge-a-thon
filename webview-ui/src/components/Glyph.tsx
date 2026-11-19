import type { ReactNode } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  Alert02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowDown02Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowUp01Icon,
  ArrowUp02Icon,
  AtIcon,
  BookOpen01Icon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  CircleIcon,
  Clock01Icon,
  CommandLineIcon,
  Compass01Icon,
  Copy01Icon,
  DashedLineCircleIcon,
  Delete02Icon,
  File01Icon,
  FileAddIcon,
  FlaskConicalIcon,
  FunctionIcon,
  GitCompareIcon,
  GitForkIcon,
  HierarchyIcon,
  HistoryIcon,
  Image01Icon,
  InformationCircleIcon,
  Layers01Icon,
  Link01Icon,
  PencilEdit02Icon,
  PinIcon,
  PlayIcon,
  Plug01Icon,
  ReloadIcon,
  Search01Icon,
  SecurityCheckIcon,
  Settings02Icon,
  SourceCodeIcon,
  StopIcon,
  Tick02Icon,
  UnavailableIcon,
  Undo02Icon,
  Unlink01Icon,
  ViewIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";

const huge = {
  at: AtIcon,
  book: BookOpen01Icon,
  check: Tick02Icon,
  "check-circle": CheckmarkCircle02Icon,
  "chevron-down": ArrowDown01Icon,
  "chevron-right": ArrowRight01Icon,
  "chevron-up": ArrowUp01Icon,
  circle: CircleIcon,
  clock: Clock01Icon,
  close: Cancel01Icon,
  code: SourceCodeIcon,
  copy: Copy01Icon,
  diff: GitCompareIcon,
  down: ArrowDown02Icon,
  error: AlertCircleIcon,
  eye: ViewIcon,
  edit: PencilEdit02Icon,
  file: File01Icon,
  "file-plus": FileAddIcon,
  flask: FlaskConicalIcon,
  history: HistoryIcon,
  image: Image01Icon,
  info: InformationCircleIcon,
  layers: Layers01Icon,
  link: Link01Icon,
  offline: Unlink01Icon,
  pending: DashedLineCircleIcon,
  pin: PinIcon,
  play: PlayIcon,
  plan: CheckListIcon,
  plug: Plug01Icon,
  plus: Add01Icon,
  retry: ReloadIcon,
  "arrow-right": ArrowRight02Icon,
  search: Search01Icon,
  settings: Settings02Icon,
  shield: SecurityCheckIcon,
  skip: UnavailableIcon,
  steer: Compass01Icon,
  stop: StopIcon,
  subagent: GitForkIcon,
  symbol: FunctionIcon,
  terminal: CommandLineIcon,
  tools: Wrench01Icon,
  trash: Delete02Icon,
  tree: HierarchyIcon,
  undo: Undo02Icon,
  up: ArrowUp02Icon,
  warning: Alert02Icon,
} satisfies Record<string, IconSvgElement>;

function stroke(children: ReactNode) {
  return (size: number, className?: string) => (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const forge = {
  hammer: stroke(
    <>
      <path d="M2 5.5 6 1.5l3.5 3.5-4 4Z" fill="currentColor" stroke="none" />
      <path d="m7.8 7.2 6.2 6.3" strokeWidth="2" />
    </>,
  ),
  lens: stroke(
    <>
      <circle cx="6.5" cy="6.5" r="4.5" />
      <circle cx="6.5" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="m10 10 4 4" />
    </>,
  ),
  notch: stroke(<path d="M8 2.5 12 8l-4 5.5L4 8Z" fill="currentColor" stroke="none" />),
  keep: stroke(
    <>
      <path d="m3 7.5 3 3 7-7" />
      <path d="M3 14h10" />
    </>,
  ),
  discard: stroke(
    <>
      <path d="m4 3.5 8 7M12 3.5l-8 7" />
      <path d="M3 14h10" />
    </>,
  ),
  strike: stroke(<path d="M9.5 1.5 4 9h4l-1.5 5.5L12 7H8Z" fill="currentColor" stroke="none" />),
};

export type GlyphName = keyof typeof huge | keyof typeof forge;

export function Icon({ name, className, size = 14, bold }: { name: GlyphName; className?: string; size?: number; bold?: boolean }) {
  const classes = `shrink-0 ${className ?? ""}`;
  if (name in forge) return forge[name as keyof typeof forge](size, classes);
  return <HugeiconsIcon icon={huge[name as keyof typeof huge]} size={size} strokeWidth={bold ? 2.2 : 1.6} aria-hidden="true" className={classes} />;
}
