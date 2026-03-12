export interface HarHeader { name: string; value: string }

export interface HarEntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: HarHeader[];
    queryString: HarHeader[];
    cookies: HarHeader[];
    postData?: { mimeType: string; text: string };
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: HarHeader[];
    cookies: HarHeader[];
    content: { size: number; mimeType: string; text?: string };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  timings: {
    blocked?: number;
    dns?: number;
    connect?: number;
    send: number;
    wait: number;
    receive: number;
    ssl?: number;
  };
}

export interface HarFile {
  log: {
    version: string;
    creator: { name: string; version: string };
    entries: HarEntry[];
  };
}

export type ResourceType = "All" | "Fetch/XHR" | "Doc" | "CSS" | "JS" | "Font" | "Img" | "Other" | "OIDC";
export type OidcPhase    = "discovery" | "authorize" | "token" | "userinfo" | "keys" | "introspect" | "revoke" | "logout" | "session" | "idx";

export interface OidcInfo { label: string; phase: OidcPhase }
