import {
  // Navigation / Sidebar
  LayoutDashboard, Webhook, UsersRound, Boxes, BadgeCheck, Crown,
  ScrollText, Puzzle, Activity, LockKeyhole, BookOpen,
  WandSparkles, Eraser, FlaskConical, Fingerprint, ScanSearch,
  ShieldCheck, Network, KeyRound,
  // Actions
  Plus, PlusCircle, Pencil, Save, Trash2, X, Copy,
  RefreshCw, RotateCcw, Search, Send, ExternalLink, GripVertical,
  // Status & Feedback
  CheckCircle2, XCircle, AlertCircle, Check, Loader2,
  // Data & Files
  FileJson, FileSearch, SquarePlus, SquareMinus, MoreHorizontal,
  // Network & Auth
  Globe, TrendingUp, ArrowUpRight, ArrowDownLeft, ArrowRight,
  Server, Unlock, Lock, Zap, Sparkles,
  // Users & Account
  LogOut, User, Mail,
  // HAR Analyser
  Waypoints, Radar, Telescope, Cable,
  // Misc
  Clock, Shuffle, Bug, Github, Separator,
  // Changelog types
  Wrench, Shield,
  // Theme toggle
  Sun, Moon,
} from "lucide-react";

import {
  IconBrandGithub,
  IconDashboard,
  IconLogs,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type LucideIcon = React.ComponentType<{ className?: string }>;

interface IconEntry {
  name:  string;
  icon:  LucideIcon;
  note?: string;
}

interface Section {
  title:   string;
  color:   string;
  icons:   IconEntry[];
}

const SECTIONS: Section[] = [
  {
    title: "Sidebar Navigation",
    color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    icons: [
      { name: "LayoutDashboard", icon: LayoutDashboard, note: "Dashboard" },
      { name: "Webhook",         icon: Webhook,         note: "API" },
      { name: "UsersRound",      icon: UsersRound,      note: "Users" },
      { name: "Boxes",           icon: Boxes,           note: "Groups" },
      { name: "BadgeCheck",      icon: BadgeCheck,      note: "Entitlements" },
      { name: "Crown",           icon: Crown,           note: "Roles" },
      { name: "ScrollText",      icon: ScrollText,      note: "Logs" },
      { name: "Puzzle",          icon: Puzzle,          note: "Extensions" },
      { name: "ScanSearch",      icon: ScanSearch,      note: "HAR Analyser ✓ new" },
      { name: "LockKeyhole",     icon: LockKeyhole,     note: "JWE Decoder" },
      { name: "Activity",        icon: Activity,        note: "Dashboard stat" },
      { name: "WandSparkles",    icon: WandSparkles,    note: "Generate Mock" },
      { name: "Eraser",          icon: Eraser,          note: "Reset Data" },
      { name: "BookOpen",        icon: BookOpen,        note: "Changelog" },
      { name: "FlaskConical",    icon: FlaskConical,    note: "Extensions empty" },
      { name: "Fingerprint",     icon: Fingerprint,     note: "Sidebar (unused?)" },
      { name: "Network",         icon: Network,         note: "Old HAR icon" },
    ],
  },
  {
    title: "SCIM Resource Icons",
    color: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800",
    icons: [
      { name: "UsersRound", icon: UsersRound, note: "Users nav + dashboard" },
      { name: "Boxes",      icon: Boxes,      note: "Groups" },
      { name: "BadgeCheck", icon: BadgeCheck, note: "Entitlements" },
      { name: "Crown",      icon: Crown,      note: "Roles" },
      { name: "KeyRound",   icon: KeyRound,   note: "API Keys" },
      { name: "ShieldCheck",icon: ShieldCheck,note: "SCIM / home card" },
      { name: "Server",     icon: Server,     note: "SCIM endpoint" },
    ],
  },
  {
    title: "Actions & Controls",
    color: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
    icons: [
      { name: "Plus",         icon: Plus,         note: "Create" },
      { name: "PlusCircle",   icon: PlusCircle,   note: "Generate key" },
      { name: "Pencil",       icon: Pencil,       note: "Edit" },
      { name: "Save",         icon: Save,         note: "Save" },
      { name: "Trash2",       icon: Trash2,       note: "Delete" },
      { name: "X",            icon: X,            note: "Close / remove" },
      { name: "Copy",         icon: Copy,         note: "Copy to clipboard" },
      { name: "RefreshCw",    icon: RefreshCw,    note: "Refresh" },
      { name: "RotateCcw",    icon: RotateCcw,    note: "Reset chat" },
      { name: "Search",       icon: Search,       note: "Search" },
      { name: "Send",         icon: Send,         note: "Send message" },
      { name: "ExternalLink", icon: ExternalLink, note: "Open external" },
      { name: "GripVertical", icon: GripVertical, note: "Drag handle" },
      { name: "MoreHorizontal",icon: MoreHorizontal, note: "Actions menu" },
    ],
  },
  {
    title: "Status & Feedback",
    color: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    icons: [
      { name: "CheckCircle2", icon: CheckCircle2, note: "Active / success" },
      { name: "XCircle",      icon: XCircle,      note: "Inactive / error" },
      { name: "AlertCircle",  icon: AlertCircle,  note: "Error alert" },
      { name: "Check",        icon: Check,        note: "Copied ✓" },
      { name: "Loader2",      icon: Loader2,      note: "Loading spinner" },
    ],
  },
  {
    title: "Network & Auth",
    color: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800",
    icons: [
      { name: "Globe",         icon: Globe,         note: "Page views" },
      { name: "TrendingUp",    icon: TrendingUp,    note: "Calls last 7d" },
      { name: "ArrowUpRight",  icon: ArrowUpRight,  note: "Response (log)" },
      { name: "ArrowDownLeft", icon: ArrowDownLeft, note: "Request (log)" },
      { name: "ArrowRight",    icon: ArrowRight,    note: "Nav arrow" },
      { name: "Unlock",        icon: Unlock,        note: "Client credentials" },
      { name: "Lock",          icon: Lock,          note: "JWE output panel" },
      { name: "Zap",           icon: Zap,           note: "Authorize endpoint" },
      { name: "Sparkles",      icon: Sparkles,      note: "AI features" },
    ],
  },
  {
    title: "Data & Files",
    color: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",
    icons: [
      { name: "FileJson",   icon: FileJson,   note: "Token input (JWE)" },
      { name: "FileSearch", icon: FileSearch, note: "HAR drop zone" },
      { name: "SquarePlus", icon: SquarePlus, note: "JSON expand" },
      { name: "SquareMinus",icon: SquareMinus,note: "JSON collapse" },
      { name: "ScrollText", icon: ScrollText, note: "Logs / Changelog" },
    ],
  },
  {
    title: "User & Account",
    color: "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800",
    icons: [
      { name: "LogOut", icon: LogOut, note: "Sign out" },
      { name: "User",   icon: User,   note: "User props reference" },
      { name: "Mail",   icon: Mail,   note: "Email field" },
      { name: "Github", icon: Github, note: "GitHub link" },
    ],
  },
  {
    title: "Changelog Types",
    color: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
    icons: [
      { name: "Plus",   icon: Plus,   note: "New" },
      { name: "Zap",    icon: Zap,    note: "Improved" },
      { name: "Bug",    icon: Bug,    note: "Fixed" },
      { name: "Wrench", icon: Wrench, note: "Breaking" },
      { name: "Shield", icon: Shield, note: "Security" },
    ],
  },
  {
    title: "Misc",
    color: "bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800",
    icons: [
      { name: "Shuffle",  icon: Shuffle,  note: "Faker generators" },
      { name: "Clock",    icon: Clock,    note: "HAR recent files" },
      { name: "Sun",      icon: Sun,      note: "Light mode toggle" },
      { name: "Moon",     icon: Moon,     note: "Dark mode toggle" },
    ],
  },
  {
    title: "HAR Analyser — Icon Candidates",
    color: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800",
    icons: [
      { name: "ScanSearch", icon: ScanSearch, note: "✓ Selected — current" },
      { name: "Waypoints",  icon: Waypoints,  note: "Candidate" },
      { name: "Radar",      icon: Radar,      note: "Candidate" },
      { name: "Telescope",  icon: Telescope,  note: "Candidate" },
      { name: "Cable",      icon: Cable,      note: "Candidate" },
      { name: "Network",    icon: Network,    note: "Previous" },
    ],
  },
  {
    title: "Tabler Icons",
    color: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800",
    icons: [
      { name: "IconBrandGithub", icon: IconBrandGithub as LucideIcon, note: "Header GitHub link" },
      { name: "IconDashboard",   icon: IconDashboard   as LucideIcon, note: "Sidebar (unused?)" },
      { name: "IconLogs",        icon: IconLogs        as LucideIcon, note: "Sidebar logs" },
    ],
  },
];

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
          All icons in use across the project. Three sizes shown: muted (14px) · foreground (16px) · primary (20px).
        </p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className={cn("rounded-lg border p-4 space-y-1", section.color)}>
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
