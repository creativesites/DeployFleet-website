import "server-only";
import { getStore } from "@/lib/adminStore";

/**
 * §5.2's durable Redis cache keys, split into their own module with zero
 * dependency on crm.ts specifically to avoid a circular import:
 * crm.ts's write functions need to call invalidate*Context() on every
 * write, but contextCompiler.ts (which builds the cached text) needs to
 * import crm.ts's read functions. Keeping the key names + the
 * invalidate/delete side here (which needs neither crm.ts nor the
 * compile logic) lets crm.ts depend on this file without ever depending
 * on contextCompiler.ts.
 */

export function prospectContextKey(prospectId: string): string {
  return `PROSPECT_CONTEXT:${prospectId}`;
}

export function employeeContextKey(employeeId: string): string {
  return `EMPLOYEE_CONTEXT:${employeeId}`;
}

export const GLOBAL_CONTEXT_KEY = "GLOBAL_CONTEXT";

/** A 24h backstop in case an invalidation call site gets missed — invalidation is event-driven (§5.2), this is a safety net, not the primary mechanism. */
export const CONTEXT_TTL_SECONDS = 24 * 60 * 60;

export async function invalidateProspectContext(prospectId: string): Promise<void> {
  await getStore().delete(prospectContextKey(prospectId));
}

export async function invalidateEmployeeContext(employeeId: string): Promise<void> {
  await getStore().delete(employeeContextKey(employeeId));
}

export async function invalidateGlobalContext(): Promise<void> {
  await getStore().delete(GLOBAL_CONTEXT_KEY);
}
