"use client";

import { useState } from "react";

import {
  // Sidebar navigation
  LayoutDashboard,
  ChartNoAxesCombined,
  Webhook,
  UsersRound,
  Boxes,
  BadgeCheck,
  Crown,
  ScrollText,
  Puzzle,
  ScanSearch,
  LockKeyhole,
  CalendarCheck,
  WandSparkles,
  Eraser,
  LifeBuoy,
  Fingerprint,
  FlaskConical,
  // SCIM resources & dashboard
  KeyRound,
  ShieldCheck,
  Server,
  Activity,
  Gauge,
  SlidersHorizontal,
  TrendingUp,
  // Actions & controls
  Plus,
  Pencil,
  Save,
  Trash2,
  X,
  Copy,
  RefreshCw,
  RotateCcw,
  Search,
  ExternalLink,
  GripVertical,
  GripHorizontal,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  UserPlus,
  UserMinus,
  Video,
  CalendarDays,
  CalendarPlus,
  // Status & feedback
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  Loader2,
  // Network & auth
  Globe,
  Unlock,
  Lock,
  Zap,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Monitor,
  Timer,
  TicketCheck,
  // Data & files
  FileJson,
  FileSearch,
  SquarePlus,
  SquareMinus,
  ListOrdered,
  // User & account
  LogOut,
  User,
  Mail,
  Github,
  Slack,
  MapPin,
  Clock,
  Keyboard,
  // Changelog
  Bug,
  Wrench,
  Shield,
  // Misc
  Ghost,
  Shuffle,
  Sun,
  Moon,
  // Notification tester
  Bell,
  BellRing,
  BellOff,
} from "lucide-react";

import { IconBrandGithub, IconDashboard, IconLogs } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type LucideIcon = React.ComponentType<{ className?: string }>;

interface IconEntry {
  name: string;
  icon: LucideIcon;
  note?: string;
}

interface Section {
  title: string;
  color: string;
  icons: IconEntry[];
}

const SECTIONS: Section[] = [
  {
    title: "Sidebar Navigation",
    color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    icons: [
      { name: "ChartNoAxesCombined", icon: ChartNoAxesCombined, note: "Dashboard" },
      { name: "LayoutDashboard",     icon: LayoutDashboard,     note: "SCIM Tool" },
      { name: "Webhook",         icon: Webhook,         note: "API" },
      { name: "UsersRound",      icon: UsersRound,      note: "Users" },
      { name: "Boxes",           icon: Boxes,           note: "Groups" },
      { name: "BadgeCheck",      icon: BadgeCheck,      note: "Entitlements" },
      { name: "Crown",           icon: Crown,           note: "Roles" },
      { name: "ScrollText",      icon: ScrollText,      note: "Logs" },
      { name: "Puzzle",          icon: Puzzle,          note: "Extensions" },
      { name: "ScanSearch",      icon: ScanSearch,      note: "HAR Analyser" },
      { name: "LockKeyhole",     icon: LockKeyhole,     note: "JWE Decoder" },
      { name: "CalendarCheck",   icon: CalendarCheck,   note: "Meeting Planner" },
      { name: "WandSparkles",    icon: WandSparkles,    note: "AI Template Builder" },
      { name: "Eraser",          icon: Eraser,          note: "Reset Data" },
      { name: "LifeBuoy",        icon: LifeBuoy,        note: "Support" },
      { name: "Fingerprint",     icon: Fingerprint,     note: "Identity / auth" },
      { name: "FlaskConical",    icon: FlaskConical,    note: "Extensions empty state" },
    ],
  },
  {
    title: "SCIM Resources & Dashboard",
    color: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800",
    icons: [
      { name: "KeyRound",         icon: KeyRound,         note: "API Keys" },
      { name: "ShieldCheck",      icon: ShieldCheck,      note: "SCIM tool card" },
      { name: "Server",           icon: Server,           note: "SCIM endpoint" },
      { name: "Activity",         icon: Activity,         note: "Total API Calls card" },
      { name: "Gauge",            icon: Gauge,            note: "User Status card" },
      { name: "SlidersHorizontal",icon: SlidersHorizontal,note: "HTTP Method breakdown" },
      { name: "TrendingUp",       icon: TrendingUp,       note: "Top Endpoints / Page Views" },
      { name: "TicketCheck",      icon: TicketCheck,      note: "Login Activity card" },
    ],
  },
  {
    title: "Actions & Controls",
    color: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
    icons: [
      { name: "Plus",          icon: Plus,          note: "Create" },
      { name: "Pencil",        icon: Pencil,        note: "Edit" },
      { name: "Save",          icon: Save,          note: "Save" },
      { name: "Trash2",        icon: Trash2,        note: "Delete" },
      { name: "X",             icon: X,             note: "Close / remove" },
      { name: "Copy",          icon: Copy,          note: "Copy to clipboard" },
      { name: "RefreshCw",     icon: RefreshCw,     note: "Refresh" },
      { name: "RotateCcw",     icon: RotateCcw,     note: "Reset (JSON template)" },
      { name: "Search",        icon: Search,        note: "Search / filter" },
      { name: "ExternalLink",  icon: ExternalLink,  note: "Open external" },
      { name: "GripVertical",  icon: GripVertical,  note: "Drag handle (timezone rows)" },
      { name: "GripHorizontal",icon: GripHorizontal,note: "Drag handle (time cursor)" },
      { name: "MoreHorizontal",icon: MoreHorizontal,note: "Row actions menu" },
      { name: "ArrowLeft",     icon: ArrowLeft,     note: "Date nav — previous" },
      { name: "ArrowRight",    icon: ArrowRight,    note: "Date nav — next" },
      { name: "ArrowUpRight",  icon: ArrowUpRight,  note: "Response (log viewer)" },
      { name: "ArrowDownLeft", icon: ArrowDownLeft, note: "Request (log viewer)" },
      { name: "ChevronLeft",   icon: ChevronLeft,   note: "Pagination previous" },
      { name: "ChevronRight",  icon: ChevronRight,  note: "Pagination next / expand row" },
      { name: "ChevronDown",   icon: ChevronDown,   note: "Collapse / accordion" },
      { name: "ChevronsUpDown",icon: ChevronsUpDown,note: "Sidebar user menu trigger" },
      { name: "UserPlus",      icon: UserPlus,      note: "Add group member" },
      { name: "UserMinus",     icon: UserMinus,     note: "Remove group member" },
      { name: "Video",         icon: Video,         note: "Schedule call" },
      { name: "CalendarDays",  icon: CalendarDays,  note: "Date picker trigger" },
      { name: "CalendarPlus",  icon: CalendarPlus,  note: "Add to Google Calendar" },
    ],
  },
  {
    title: "Status & Feedback",
    color: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    icons: [
      { name: "CheckCircle2", icon: CheckCircle2, note: "Active / success" },
      { name: "XCircle",      icon: XCircle,      note: "Inactive / error" },
      { name: "AlertCircle",  icon: AlertCircle,  note: "Error alert" },
      { name: "Check",        icon: Check,        note: "Copied confirmation" },
      { name: "Loader2",      icon: Loader2,      note: "Loading spinner" },
    ],
  },
  {
    title: "Network & Auth",
    color: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800",
    icons: [
      { name: "Globe",    icon: Globe,    note: "Timezone / page views" },
      { name: "Unlock",   icon: Unlock,   note: "Client credentials" },
      { name: "Lock",     icon: Lock,     note: "JWE decoded output" },
      { name: "Zap",      icon: Zap,      note: "OAuth authorize endpoint" },
      { name: "Sparkles", icon: Sparkles, note: "AI features" },
      { name: "Monitor",  icon: Monitor,  note: "Local environment badge" },
      { name: "Timer",    icon: Timer,    note: "Rate limit section" },
    ],
  },
  {
    title: "Data & Files",
    color: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",
    icons: [
      { name: "FileJson",    icon: FileJson,    note: "JWE token input" },
      { name: "FileSearch",  icon: FileSearch,  note: "HAR drop zone" },
      { name: "SquarePlus",  icon: SquarePlus,  note: "JSON expand" },
      { name: "SquareMinus", icon: SquareMinus, note: "JSON collapse" },
      { name: "ListOrdered", icon: ListOrdered, note: "Okta setup steps" },
    ],
  },
  {
    title: "User & Account",
    color: "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800",
    icons: [
      { name: "LogOut",   icon: LogOut,   note: "Sign out" },
      { name: "User",     icon: User,     note: "User timezone avatar" },
      { name: "Mail",     icon: Mail,     note: "Email field" },
      { name: "Github",   icon: Github,   note: "GitHub links" },
      { name: "Slack",    icon: Slack,    note: "Slack support link" },
      { name: "MapPin",   icon: MapPin,   note: "Timezone selector" },
      { name: "Clock",    icon: Clock,    note: "Session signed-in time" },
      { name: "Keyboard", icon: Keyboard, note: "Keyboard shortcuts" },
    ],
  },
  {
    title: "Changelog",
    color: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
    icons: [
      { name: "Plus",    icon: Plus,    note: "New" },
      { name: "Zap",     icon: Zap,     note: "Improved" },
      { name: "Bug",     icon: Bug,     note: "Fixed" },
      { name: "Wrench",  icon: Wrench,  note: "Breaking" },
      { name: "Shield",  icon: Shield,  note: "Security" },
    ],
  },
  {
    title: "Misc",
    color: "bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800",
    icons: [
      { name: "Ghost",   icon: Ghost,   note: "404 page" },
      { name: "Shuffle", icon: Shuffle, note: "Faker generators" },
      { name: "Sun",     icon: Sun,     note: "Light mode toggle" },
      { name: "Moon",    icon: Moon,    note: "Dark mode toggle" },
    ],
  },
  {
    title: "Tabler Icons",
    color: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800",
    icons: [
      { name: "IconBrandGithub", icon: IconBrandGithub as LucideIcon, note: "Header GitHub link" },
      { name: "IconDashboard",   icon: IconDashboard   as LucideIcon, note: "Sidebar dashboard" },
      { name: "IconLogs",        icon: IconLogs        as LucideIcon, note: "Sidebar logs" },
    ],
  },
];

function NotificationTester() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [lastSent, setLastSent] = useState<string | null>(null);

  const handleTest = async () => {
    if (!("Notification" in window)) return;

    let perm = permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }

    if (perm === "granted") {
      new Notification("Test Notification 🔔", {
        body: "Browser notifications are working correctly.",
        icon: "/okta.svg",
      });
      setLastSent(new Date().toLocaleTimeString());
    }
  };

  const Icon   = permission === "granted" ? BellRing : permission === "denied" ? BellOff : Bell;
  const label  = permission === "granted" ? "Send test notification"
               : permission === "denied"  ? "Notifications blocked"
               :                           "Enable & test notification";
  const status = permission === "granted" ? "text-green-600 dark:text-green-400"
               : permission === "denied"  ? "text-red-500 dark:text-red-400"
               :                           "text-muted-foreground";

  return (
    <div className="rounded-lg border p-4 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Browser Notification Test
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleTest}
          disabled={permission === "denied"}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
        <span className={cn("text-xs font-mono", status)}>
          permission: {permission}
        </span>
      </div>
      {lastSent && (
        <p className="text-xs text-muted-foreground">
          Last sent at <span className="font-medium">{lastSent}</span>
        </p>
      )}
    </div>
  );
}

function IconRow({ name, icon: Icon, note }: IconEntry) {
  return (
    <div className="flex items-center gap-4 rounded-md px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-3 flex-shrink-0 w-20">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <Icon className="h-4 w-4 text-foreground" />
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <code className="text-xs font-mono w-44 flex-shrink-0">{name}</code>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

export default function IconPreviewPage() {
  return (
    <div className="container mx-auto py-10 max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold">Project Icon Reference</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All icons in active use across the project. Three sizes shown: muted (14 px) · foreground (16 px) · primary (20 px).
        </p>
      </div>

      <NotificationTester />

      {SECTIONS.map((section) => (
        <div
          key={section.title}
          className={cn("rounded-lg border p-4 space-y-1", section.color)}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {section.title}
          </p>
          {section.icons.map((entry) => (
            <IconRow key={entry.name} {...entry} />
          ))}
        </div>
      ))}
    </div>
  );
}
