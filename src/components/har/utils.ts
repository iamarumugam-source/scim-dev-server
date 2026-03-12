import type { HarEntry, OidcInfo, ResourceType } from "./types";
import { OIDC_PATTERNS } from "./constants";

export function getResourceType(entry: HarEntry): ResourceType {
  const mime = entry.response.content?.mimeType ?? "";
  const url  = entry.request.url;
  if (mime.includes("json") || mime.includes("xml") || mime.includes("form"))    return "Fetch/XHR";
  if (mime.includes("html"))                                                       return "Doc";
  if (mime.includes("css") || url.endsWith(".css"))                               return "CSS";
  if (mime.includes("javascript") || mime.includes("/js") || url.endsWith(".js")) return "JS";
  if (mime.includes("font") || /\.(woff2?|ttf|eot|otf)/.test(url))               return "Font";
  if (mime.includes("image"))                                                      return "Img";
  return "Other";
}

export function getStatusClass(status: number): string {
  if (status >= 500) return "text-red-600 dark:text-red-400 font-semibold";
  if (status >= 400) return "text-red-500 dark:text-red-400";
  if (status >= 300) return "text-purple-600 dark:text-purple-400";
  return "";
}

export function getRowClass(status: number): string {
  if (status >= 400) return "bg-red-50/60 dark:bg-red-950/20";
  if (status >= 300) return "bg-purple-50/40 dark:bg-purple-950/10";
  return "";
}

export function getMethodClass(method: string): string {
  switch (method?.toUpperCase()) {
    case "GET":    return "text-blue-600 dark:text-blue-400";
    case "POST":   return "text-green-600 dark:text-green-400";
    case "PUT":
    case "PATCH":  return "text-amber-600 dark:text-amber-400";
    case "DELETE": return "text-red-600 dark:text-red-400";
    default:       return "text-muted-foreground";
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1)    return "< 1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function urlName(url: string): string {
  try {
    const u     = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || u.hostname;
  } catch {
    return url;
  }
}

export function tryParseJson(text?: string): unknown {
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

export function getOidcInfo(url: string, method: string): OidcInfo | null {
  try {
    const path = new URL(url).pathname;
    for (const def of OIDC_PATTERNS) {
      if (def.pattern.test(path) && (!def.methods || def.methods.includes(method.toUpperCase()))) {
        return { label: def.label, phase: def.phase };
      }
    }
  } catch {}
  return null;
}

export function hasOktaHeader(entry: HarEntry): boolean {
  return entry.request.headers.some(
    (h) => h.name.toLowerCase().includes("okta") || h.value.toLowerCase().includes("okta"),
  );
}

export function tryBase64UrlDecode(value: string): { text: string; parsed: boolean } | null {
  try {
    const b64  = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad  = b64.length % 4;
    const full = pad ? b64 + "=".repeat(4 - pad) : b64;
    const raw  = atob(full);
    if (/[\x00-\x08\x0e-\x1f]/.test(raw)) return null;
    try {
      return { text: JSON.stringify(JSON.parse(raw), null, 2), parsed: true };
    } catch {
      return raw.length > 3 ? { text: raw, parsed: false } : null;
    }
  } catch {
    return null;
  }
}
