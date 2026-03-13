"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, User, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { USER_PROPS, FAKER_GENERATORS } from "./constants";

const FAKER_BY_CATEGORY = FAKER_GENERATORS.reduce<Record<string, typeof FAKER_GENERATORS>>(
  (acc, g) => { (acc[g.category] ??= []).push(g); return acc; },
  {},
);

const CATEGORY_COLORS: Record<string, string> = {
  Person:   "text-blue-600 dark:text-blue-400",
  Company:  "text-violet-600 dark:text-violet-400",
  Location: "text-teal-600 dark:text-teal-400",
  Contact:  "text-amber-600 dark:text-amber-400",
  Finance:  "text-green-600 dark:text-green-400",
  Date:     "text-orange-600 dark:text-orange-400",
  System:   "text-slate-600 dark:text-slate-400",
  Text:     "text-rose-600 dark:text-rose-400",
};

function Section({
  title, icon: Icon, iconClass, children,
}: {
  title: string;
  icon: React.ElementType;
  iconClass: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 w-full text-left mb-2 group"
      >
        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", iconClass)} />
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {open
          ? <ChevronDown  className="h-3 w-3 text-muted-foreground ml-auto" />
          : <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />}
      </button>
      {open && children}
    </div>
  );
}

function Token({ value, className }: { value: string; className?: string }) {
  return (
    <code className={cn("text-[10px] font-mono px-1 py-0.5 rounded bg-primary/5 text-primary", className)}>
      {`{{${value}}}`}
    </code>
  );
}

export function ReferenceCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Template Reference</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use these expressions inside any field value — including inside Raw JSON templates.
          </p>
        </div>
      </div>

      {/* User Properties */}
      <Section title="User Properties" icon={User} iconClass="text-blue-500">
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-2.5 py-1.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide w-1/3">Expression</th>
                <th className="text-left px-2.5 py-1.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {USER_PROPS.map((p) => (
                <tr key={p.value} className="hover:bg-muted/30 transition-colors">
                  <td className="px-2.5 py-1.5 font-mono">
                    <Token value={`user.${p.value}`} />
                  </td>
                  <td className="px-2.5 py-1.5 text-muted-foreground">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Any dot-path into the SCIM user object works — e.g.{" "}
          <code className="font-mono">{"{{user.emails.1.value}}"}</code> for the second email.
        </p>
      </Section>

      {/* Faker generators */}
      <Section title="Faker Generators" icon={Shuffle} iconClass="text-violet-500">
        <div className="space-y-3">
          {Object.entries(FAKER_BY_CATEGORY).map(([category, generators]) => (
            <div key={category}>
              <p className={cn("text-[10px] font-bold uppercase tracking-wide mb-1", CATEGORY_COLORS[category] ?? "text-muted-foreground")}>
                {category}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {generators.map((g) => (
                  <div key={g.value} className="flex items-center gap-1">
                    <Token value={`faker.${g.value}`} />
                    <span className="text-[10px] text-muted-foreground">{g.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <a
            href="https://fakerjs.dev/api/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
          >
            <ExternalLink className="h-3 w-3" />
            Full Faker.js API reference
          </a>
          <span className="text-[10px] text-muted-foreground">— any method listed there works as a generator</span>
        </div>
      </Section>

      {/* How it works */}
      <div className="rounded-md bg-muted/30 border border-border/60 p-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide">How it works</p>
        <ul className="space-y-1 ml-3 list-disc">
          <li><strong className="text-foreground">User Property</strong> — reads the value from the SCIM user at request time</li>
          <li><strong className="text-foreground">Random (Faker)</strong> — generates a fresh value on every API call</li>
          <li><strong className="text-foreground">Static</strong> — always returns the exact value you configure</li>
          <li><strong className="text-foreground">Raw JSON</strong> — any structure; embed <code className="font-mono">{"{{...}}"}</code> expressions inside string values</li>
          <li>Extensions are cached for 30 s and applied as an interceptor — stored user data is never modified</li>
        </ul>
      </div>
    </div>
  );
}
