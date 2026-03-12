import type { OidcPhase, ResourceType } from "./types";

export const OIDC_PATTERNS: Array<{
  pattern: RegExp;
  methods?: string[];
  label: string;
  phase: OidcPhase;
}> = [
  { pattern: /\/.well-known\/openid-configuration/,       label: "Discovery",        phase: "discovery"  },
  { pattern: /\/.well-known\/oauth-authorization-server/, label: "AS Metadata",       phase: "discovery"  },
  { pattern: /\/v1\/authorize$/,                           label: "Authorize",        phase: "authorize"  },
  { pattern: /\/v1\/par$/,             methods: ["POST"],  label: "PAR",              phase: "authorize"  },
  { pattern: /\/login\/login\.htm/,                        label: "Login Page",       phase: "authorize"  },
  { pattern: /\/login\/sessionCookieRedirect/,             label: "Session Redirect", phase: "authorize"  },
  { pattern: /\/sso\/idps\//,                              label: "SSO IdP",          phase: "authorize"  },
  { pattern: /\/v1\/token$/,           methods: ["POST"],  label: "Token",            phase: "token"      },
  { pattern: /\/v1\/userinfo$/,                            label: "UserInfo",         phase: "userinfo"   },
  { pattern: /\/v1\/keys$/,            methods: ["GET"],   label: "JWKS",             phase: "keys"       },
  { pattern: /\/v1\/introspect$/,      methods: ["POST"],  label: "Introspect",       phase: "introspect" },
  { pattern: /\/v1\/revoke$/,          methods: ["POST"],  label: "Revoke",           phase: "revoke"     },
  { pattern: /\/v1\/logout$/,                              label: "Logout",           phase: "logout"     },
  { pattern: /\/v1\/end_session$/,                         label: "End Session",      phase: "logout"     },
  { pattern: /\/v1\/device\/authorize$/,                   label: "Device Auth",      phase: "authorize"  },
  { pattern: /\/api\/v1\/authn$/,      methods: ["POST"],  label: "Authn",            phase: "session"    },
  { pattern: /\/api\/v1\/sessions/,                        label: "Session",          phase: "session"    },
  { pattern: /\/idp\/idx\/introspect$/, methods: ["POST"], label: "IDX Introspect",   phase: "idx"        },
  { pattern: /\/idp\/idx\/identify$/,   methods: ["POST"], label: "IDX Identify",     phase: "idx"        },
  { pattern: /\/idp\/idx\/challenge/,                      label: "IDX Challenge",    phase: "idx"        },
  { pattern: /\/idp\/idx\//,                               label: "IDX",              phase: "idx"        },
];

export const OIDC_STYLES: Record<OidcPhase, { badge: string; row: string }> = {
  discovery:  { badge: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",        row: "bg-slate-50/60 dark:bg-slate-900/20"   },
  authorize:  { badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-300",         row: "bg-blue-50/50 dark:bg-blue-950/20"     },
  token:      { badge: "bg-green-100 text-green-700 dark:bg-green-900/70 dark:text-green-300",     row: "bg-green-50/50 dark:bg-green-950/20"   },
  userinfo:   { badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-300", row: "bg-violet-50/50 dark:bg-violet-950/20" },
  keys:       { badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/70 dark:text-cyan-300",         row: "bg-cyan-50/50 dark:bg-cyan-950/20"     },
  introspect: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300",     row: "bg-amber-50/50 dark:bg-amber-950/20"   },
  revoke:     { badge: "bg-red-100 text-red-600 dark:bg-red-900/70 dark:text-red-300",             row: "bg-red-50/30 dark:bg-red-950/10"       },
  logout:     { badge: "bg-red-100 text-red-600 dark:bg-red-900/70 dark:text-red-300",             row: "bg-red-50/30 dark:bg-red-950/10"       },
  session:    { badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/70 dark:text-orange-300", row: "bg-orange-50/50 dark:bg-orange-950/20" },
  idx:        { badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/70 dark:text-pink-300",         row: "bg-pink-50/50 dark:bg-pink-950/20"     },
};

export const OKTA_STYLE = {
  badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300",
  row:   "bg-indigo-50/40 dark:bg-indigo-950/15",
};

export const TIMING_BARS: { key: "blocked" | "dns" | "connect" | "ssl" | "send" | "wait" | "receive"; label: string; color: string }[] = [
  { key: "blocked", label: "Stalled",           color: "bg-gray-400"   },
  { key: "dns",     label: "DNS Lookup",         color: "bg-teal-400"   },
  { key: "connect", label: "Initial connection", color: "bg-orange-400" },
  { key: "ssl",     label: "SSL",                color: "bg-purple-400" },
  { key: "send",    label: "Request sent",        color: "bg-green-400"  },
  { key: "wait",    label: "Waiting (TTFB)",      color: "bg-green-600"  },
  { key: "receive", label: "Content download",    color: "bg-blue-500"   },
];

export const OIDC_PARAM_INFO: Record<string, { label: string; description: string; decode?: boolean }> = {
  client_id:                { label: "Client ID",              description: "OAuth 2.0 client identifier registered with the authorization server" },
  response_type:            { label: "Response Type",          description: "Requested response: code · token · id_token" },
  response_mode:            { label: "Response Mode",          description: "How the response is delivered: query · fragment · form_post" },
  redirect_uri:             { label: "Redirect URI",           description: "URI the browser is redirected to after authentication" },
  scope:                    { label: "Scope",                  description: "Requested permissions — space-separated list of scopes" },
  state:                    { label: "State",                  description: "Opaque value for CSRF protection and application state restoration", decode: true },
  nonce:                    { label: "Nonce",                  description: "Random value embedded in the ID token to prevent replay attacks" },
  prompt:                   { label: "Prompt",                 description: "Controls UI display: none · login · consent · select_account" },
  login_hint:               { label: "Login Hint",             description: "Pre-fills the username or email in the sign-in form" },
  code_challenge:           { label: "Code Challenge",         description: "PKCE — base64url(SHA-256(code_verifier))" },
  code_challenge_method:    { label: "Challenge Method",       description: "PKCE method: S256 (recommended) or plain" },
  code:                     { label: "Auth Code",              description: "Short-lived authorization code to exchange for tokens" },
  grant_type:               { label: "Grant Type",             description: "authorization_code · client_credentials · refresh_token · device_code" },
  code_verifier:            { label: "Code Verifier",          description: "PKCE — the random secret that generated code_challenge" },
  token_type_hint:          { label: "Token Type Hint",        description: "Hint for revoke/introspect: access_token · refresh_token" },
  id_token_hint:            { label: "ID Token Hint",          description: "Hints about the end-user for logout" },
  post_logout_redirect_uri: { label: "Post-Logout URI",        description: "URI to redirect after the session is ended" },
  session_token:            { label: "Session Token",          description: "Okta session token used to obtain tokens without re-authentication" },
  request:                  { label: "Request Object",         description: "JWT-encoded OpenID Connect request (RFC 9101)", decode: true },
  request_uri:              { label: "Request URI",            description: "URI pointing to a JWT request object" },
  acr_values:               { label: "ACR Values",             description: "Requested authentication context class references" },
  max_age:                  { label: "Max Age",                description: "Maximum time (seconds) since last authentication" },
  ui_locales:               { label: "UI Locales",             description: "Preferred UI languages for the sign-in page" },
  display:                  { label: "Display",                description: "How to render the auth page: page · popup · touch · wap" },
  access_token:             { label: "Access Token",           description: "Bearer token to be introspected or revoked" },
  id_token:                 { label: "ID Token",               description: "JWT identity token", decode: true },
  refresh_token:            { label: "Refresh Token",          description: "Long-lived token used to obtain new access tokens" },
  username:                 { label: "Username",               description: "Resource Owner Password Credentials username" },
  password:                 { label: "Password",               description: "Resource Owner Password Credentials password" },
  client_assertion_type:    { label: "Client Assertion Type",  description: "JWT bearer assertion: urn:ietf:params:oauth:client-assertion-type:jwt-bearer" },
  client_assertion:         { label: "Client Assertion",       description: "Signed JWT used for private_key_jwt client authentication", decode: true },
  dpop:                     { label: "DPoP Proof",             description: "Demonstration of Proof-of-Possession JWT", decode: true },
};

export const TYPE_FILTERS: ResourceType[] = ["All", "Fetch/XHR", "Doc", "CSS", "JS", "Font", "Img", "Other", "OIDC"];
