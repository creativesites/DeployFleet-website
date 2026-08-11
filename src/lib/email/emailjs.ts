import "server-only";

/**
 * EmailJS's send REST API, called server-side (see docs/email-templates.md
 * for the full reasoning) rather than through their browser SDK. This is
 * a deliberate deviation from the architecture doc's own literal wording
 * ("a route wrapping EmailJS's client SDK") — the send call itself, not
 * just the daily-cap check, has to happen server-side for the cap to be
 * a real limit rather than a client-trusted one: if the browser held the
 * public key and made the actual EmailJS call itself, nothing would stop
 * a modified client from calling EmailJS directly and skipping this
 * route's cap check entirely. EmailJS's REST API is a plain HTTP POST
 * that works from any runtime, not literally browser-only — calling it
 * from Node.js needs the account's Private Key (Account → Security) as
 * an `accessToken`, since EmailJS's own origin/strict-mode check would
 * otherwise reject a non-browser request.
 */

const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";
const TIMEOUT_MS = 12_000;

export interface EmailJsSendResult {
  ok: boolean;
  errorMessage?: string;
}

export function isEmailJsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY && process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID && process.env.EMAILJS_PRIVATE_KEY);
}

export async function sendEmailJsTemplate(templateId: string, templateParams: Record<string, string>): Promise<EmailJsSendResult> {
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!publicKey || !serviceId || !privateKey) {
    return { ok: false, errorMessage: "not_configured" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(EMAILJS_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: templateParams,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      return { ok: false, errorMessage: text || `http_${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    return { ok: false, errorMessage: message };
  } finally {
    clearTimeout(timeoutId);
  }
}
