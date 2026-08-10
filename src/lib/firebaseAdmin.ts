import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-only, privileged Firestore access for the admin dashboard —
 * reads and writes here go through a service account and bypass
 * firestore.rules entirely, unlike the public client SDK writes in
 * leads.ts/pageviews.ts. Never import this from a client component.
 *
 * Requires a real Firebase service account (Firebase Console > Project
 * Settings > Service Accounts > Generate new private key), unlike
 * firebase.ts's client config, which is safe to ship without one —
 * this is the actual secret in this project's Firebase setup. Gracefully
 * reports "not configured" rather than crashing when unset, the same
 * discipline as the old isAdminConfigured() password check.
 */
export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

let app: App | null = null;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Hosting platforms (Vercel included) require multi-line secrets
      // pasted as a single-line env var with literal \n sequences —
      // convert back to real newlines or the PEM key fails to parse.
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
  return app;
}

export function getAdminFirestore(): Firestore {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("Firebase Admin isn't configured — check isFirebaseAdminConfigured() before calling this.");
  }
  return getFirestore(getAdminApp());
}
