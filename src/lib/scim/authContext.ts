// Records how a request was (or wasn't) authenticated so the request logger
// can include it.  Kept in its own module so logging.ts doesn't have to import
// apiHelper.ts (which pulls in NextAuth).

export interface AuthInfo {
  /** e.g. "api_key:bearer", "api_key:ssws", "jwt:local", "jwt:okta", "session", "failed:ssws", "none" */
  method: string;
  /** Present for API key authentication only. */
  apiKeyId?: string;
  apiKeyName?: string;
}

const authInfoByRequest = new WeakMap<object, AuthInfo>();

export function setAuthInfo(request: object, info: AuthInfo): void {
  authInfoByRequest.set(request, info);
}

export function getAuthInfo(request: object): AuthInfo | undefined {
  return authInfoByRequest.get(request);
}
