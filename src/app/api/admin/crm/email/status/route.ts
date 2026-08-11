import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { countEmailSendsToday, DAILY_EMAIL_CAP } from "@/lib/crm";
import { isEmailJsConfigured } from "@/lib/email/emailjs";

/** Read by SendEmailPanel to show "N/20 sent today" and whether EmailJS is even configured yet, before Winston tries to send. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const configured =
    isEmailJsConfigured() && Boolean(process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_COLD_OUTREACH) && Boolean(process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_FOLLOWUP);
  const sentToday = await countEmailSendsToday();

  return NextResponse.json({ ok: true, configured, sentToday, cap: DAILY_EMAIL_CAP });
}
