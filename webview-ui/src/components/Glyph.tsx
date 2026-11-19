import type { ReactNode } from "react";
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  AtIcon,
  BookOpenIcon,
  CaretDownIcon,
  CaretRightIcon,
  CaretUpIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleDashedIcon,
  CircleIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  CodeIcon,
  EyeIcon,
  FileIcon,
  FilePlusIcon,
  FlaskIcon,
  FunctionIcon,
  GearSixIcon,
  GitDiffIcon,
  GitForkIcon,
  ImageIcon,
  InfoIcon,
  LinkBreakIcon,
  LinkIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlugIcon,
  PlusIcon,
  ProhibitIcon,
  PushPinIcon,
  ShieldCheckIcon,
  StackIcon,
  SteeringWheelIcon,
  StopIcon,
  TerminalWindowIcon,
  TrashIcon,
  TreeStructureIcon,
  WarningIcon,
  WarningOctagonIcon,
  WrenchIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

const phosphor = {
  at: AtIcon,
  book: BookOpenIcon,
  check: CheckIcon,
  "check-circle": CheckCircleIcon,
  "chevron-down": CaretDownIcon,
  "chevron-right": CaretRightIcon,
  "chevron-up": CaretUpIcon,
  circle: CircleIcon,
  clock: ClockIcon,
  close: XIcon,
  code: CodeIcon,
  diff: GitDiffIcon,
  down: ArrowDownIcon,
  error: WarningOctagonIcon,
  eye: EyeIcon,
  edit: PencilSimpleIcon,
  file: FileIcon,
  "file-plus": FilePlusIcon,
  flask: FlaskIcon,
  history: ClockCounterClockwiseIcon,
  image: ImageIcon,
  info: InfoIcon,
  layers: StackIcon,
  link: LinkIcon,
  offline: LinkBreakIcon,
  pending: CircleDashedIcon,
  pin: PushPinIcon,
  play: PlayIcon,
  plan: ListChecksIcon,
  plug: PlugIcon,
  plus: PlusIcon,
  retry: ArrowClockwiseIcon,
  "arrow-right": ArrowRightIcon,
  search: MagnifyingGlassIcon,
  settings: GearSixIcon,
  shield: ShieldCheckIcon,
  skip: ProhibitIcon,
  steer: SteeringWheelIcon,
  stop: StopIcon,
  subagent: GitForkIcon,
  symbol: FunctionIcon,
  terminal: TerminalWindowIcon,
  tools: WrenchIcon,
  trash: TrashIcon,
  tree: TreeStructureIcon,
  undo: ArrowCounterClockwiseIcon,
  up: ArrowUpIcon,
  warning: WarningIcon,
} satisfies Record<string, PhosphorIcon>;

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

export type GlyphName = keyof typeof phosphor | keyof typeof forge;

export function Icon({ name, className, size = 14, bold }: { name: GlyphName; className?: string; size?: number; bold?: boolean }) {
  const classes = `shrink-0 ${className ?? ""}`;
  if (name in forge) return forge[name as keyof typeof forge](size, classes);
  const Glyph = phosphor[name as keyof typeof phosphor];
  return <Glyph size={size} weight={bold ? "bold" : "regular"} aria-hidden="true" className={classes} />;
}
