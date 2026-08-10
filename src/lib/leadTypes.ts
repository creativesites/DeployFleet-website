/**
 * Pure types, no Firebase imports — safe to import from both client
 * code (leads.ts, the forms) and server code (the /api/admin/leads
 * route handler, which uses the privileged Admin SDK via
 * firebaseAdmin.ts instead of the client app in firebase.ts). Importing
 * leads.ts itself from a server route would pull in the client Firebase
 * app init for no reason and blur which SDK is actually being used.
 */
export type LeadSource = "contact-form" | "homepage-cta" | "demo-gate";

export type LeadStatus = "new" | "contacted" | "demo-booked" | "customer" | "lost";

export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "demo-booked", "customer", "lost"];
