import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const VISITOR_ID_KEY = "deployfleet-visitor-id";

/**
 * A random, locally-generated id reused across visits — enough to
 * approximate "unique visitors" in the admin dashboard without cookies,
 * fingerprinting, or a third-party analytics vendor. Not tied to any
 * real identity; nothing here is PII.
 */
function getVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_ID_KEY, generated);
    return generated;
  } catch {
    // Private browsing / storage disabled — fall back to a per-load id
    // rather than failing the pageview entirely.
    return crypto.randomUUID();
  }
}

/**
 * Fire-and-forget — a failed pageview log must never be visible to the
 * visitor or affect page rendering. This is a lightweight internal
 * counter for the admin dashboard, not a replacement for Firebase
 * Analytics (which the Firebase project already has configured
 * separately, for whoever wants the fuller GA4-style breakdown).
 */
export async function logPageview(path: string): Promise<void> {
  try {
    await addDoc(collection(db, "pageviews"), {
      path,
      referrer: document.referrer || null,
      visitorId: getVisitorId(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("logPageview failed", error);
  }
}
