// Schema extension interceptor.
// Applies any enabled tenant schema extensions to a SCIM user on the fly.
// No values are stored — everything is computed at response time.

import { extensionService } from "@/lib/scim/services/extensionService";

export async function withExtensions(
  user: Record<string, unknown>,
  tenantId: string,
): Promise<Record<string, unknown>> {
  return extensionService.applyExtensions(user, tenantId);
}
