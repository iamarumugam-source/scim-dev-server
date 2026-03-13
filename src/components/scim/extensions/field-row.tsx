"use client";

import { GripVertical, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ExtensionField } from "@/lib/scim/services/extensionService";
import { FAKER_GENERATORS, USER_PROPS, FIELD_TYPES } from "./constants";
import { RawJsonEditor } from "./raw-json-editor";

interface Props {
  field:    ExtensionField;
  onChange: (f: ExtensionField) => void;
  onRemove: () => void;
}

export function FieldRow({ field, onChange, onRemove }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/20 p-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto]">
      <div className="flex items-center text-muted-foreground sm:mt-1">
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Attribute Name
        </label>
        <Input
          value={field.name}
          placeholder="e.g. employments"
          className="h-7 text-xs font-mono"
          onChange={(e) => onChange({ ...field, name: e.target.value })}
        />
        {!field.name.trim() && field.source === "raw_json" && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            Empty name + object → keys spread directly into extension.
            Add a name (e.g. <code className="font-mono">employments</code>) to nest under that key.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type</label>
        <select
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value as ExtensionField["type"] })}
          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source</label>
        <div className="space-y-1">
          <select
            value={field.source}
            onChange={(e) => onChange({
              ...field,
              source:      e.target.value as ExtensionField["source"],
              userProp:    undefined,
              generator:   undefined,
              staticValue: undefined,
              rawJson:     undefined,
            })}
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="user_prop">User Property</option>
            <option value="random">Random (Faker)</option>
            <option value="static">Static Value</option>
            <option value="raw_json">Raw JSON (object / array)</option>
          </select>

          {field.source === "user_prop" && (
            <select
              value={field.userProp ?? ""}
              onChange={(e) => onChange({ ...field, userProp: e.target.value })}
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">— select property —</option>
              {USER_PROPS.map((p) => (
                <option key={p.value} value={p.value}>{p.label} ({p.value})</option>
              ))}
            </select>
          )}

          {field.source === "random" && (
            <select
              value={field.generator ?? ""}
              onChange={(e) => onChange({ ...field, generator: e.target.value })}
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">— select generator —</option>
              {FAKER_GENERATORS.map((g) => (
                <option key={g.value} value={g.value}>{g.label} ({g.category})</option>
              ))}
            </select>
          )}

          {field.source === "static" && (
            <Input
              value={String(field.staticValue ?? "")}
              placeholder="Static value"
              className="h-7 text-xs"
              onChange={(e) => onChange({ ...field, staticValue: e.target.value })}
            />
          )}

          {field.source === "raw_json" && (
            <RawJsonEditor
              value={field.rawJson ?? ""}
              onChange={(v) => onChange({ ...field, rawJson: v })}
            />
          )}
        </div>
      </div>

      <button
        onClick={onRemove}
        className="mt-5 self-start text-muted-foreground hover:text-destructive transition-colors sm:mt-6"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
