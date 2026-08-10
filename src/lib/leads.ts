import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { LeadSource, LeadStatus } from "./leadTypes";

export type { LeadSource, LeadStatus } from "./leadTypes";

export interface LeadInput {
  name: string;
  company: string;
  phone: string;
  fleetSize?: string;
  message?: string;
  source: LeadSource;
}

/**
 * Fire-and-forget lead persistence — every caller keeps its existing
 * WhatsApp-open behavior as the primary, always-working path; this is an
 * addition for the admin dashboard, not a replacement, and must never
 * block or fail a form submission the visitor is relying on. Writes are
 * public/unauthenticated by design (see firestore.rules: create-only,
 * field-validated, no read/update/delete from the client) — there's no
 * signed-in visitor to authenticate against on a marketing site's lead
 * forms.
 */
export async function submitLead(input: LeadInput): Promise<void> {
  try {
    await addDoc(collection(db, "leads"), {
      name: input.name,
      company: input.company,
      phone: input.phone,
      fleetSize: input.fleetSize ?? null,
      message: input.message ?? null,
      source: input.source,
      status: "new" satisfies LeadStatus,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Never let a lead-persistence failure block the form's real
    // submission path (WhatsApp) or surface as a user-facing error.
    console.error("submitLead failed", error);
  }
}
