"use client";

import { GripVertical, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      {/* Drag handle */}
      <div className="flex items-center text-muted-foreground sm:mt-6">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Attribute Name */}
      <div className="space-y-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Attribute Name
        </Label>
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

      {/* Type */}
      <div className="space-y-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Type
        </Label>
        <Select
          value={field.type}
          onValueChange={(v) => onChange({ ...field, type: v as ExtensionField["type"] })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Source */}
      <div className="space-y-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Source
        </Label>
        <div className="space-y-1">
          <Select
            value={field.source}
            onValueChange={(v) => onChange({
              ...field,
              source:      v as ExtensionField["source"],
              userProp:    undefined,
              generator:   undefined,
              staticValue: undefined,
              rawJson:     undefined,
            })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user_prop" className="text-xs">User Property</SelectItem>
              <SelectItem value="random"    className="text-xs">Random (Faker)</SelectItem>
              <SelectItem value="static"    className="text-xs">Static Value</SelectItem>
              <SelectItem value="raw_json"  className="text-xs">Raw JSON (object / array)</SelectItem>
            </SelectContent>
          </Select>

          {field.source === "user_prop" && (
            <Select
              value={field.userProp ?? ""}
              onValueChange={(v) => onChange({ ...field, userProp: v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="— select property —" />
              </SelectTrigger>
              <SelectContent>
                {USER_PROPS.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    {p.label} <span className="text-muted-foreground font-mono">({p.value})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.source === "random" && (
            <Select
              value={field.generator ?? ""}
              onValueChange={(v) => onChange({ ...field, generator: v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="— select generator —" />
              </SelectTrigger>
              <SelectContent>
                {FAKER_GENERATORS.map((g) => (
                  <SelectItem key={g.value} value={g.value} className="text-xs">
                    {g.label} <span className="text-muted-foreground">({g.category})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="mt-5 self-start h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 sm:mt-6"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
