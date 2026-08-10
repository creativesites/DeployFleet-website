"use client";

import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/**
 * Client-side Firebase init for lead capture and the visitor-stats
 * counter. The values below are NOT secrets — Firebase's own docs are
 * explicit that this config is safe to ship in client bundles; the
 * product's real security boundary is Firestore Security Rules
 * (firestore.rules), not hiding these fields. They're still read from
 * env vars first (so a different Firebase project can be swapped in per
 * environment with no code change), with these values as the fallback
 * default — the same "hardcode the non-secret, env-override available"
 * choice this file's neighbor `nav.ts` already makes for WHATSAPP_NUMBER.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBXqj3e_YcU5CqwfpZwY5igjv_0kQGTdIc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "deployfleet-68d4a.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "deployfleet-68d4a",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "deployfleet-68d4a.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "994173527780",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:994173527780:web:aab207dbefdae607aa2ef1",
};

// getApps().length guard: Next.js hot-reloads client modules in dev,
// and initializeApp() throws on a second call for the same app name.
export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
