import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/adminStore";
import { requireAdmin } from "@/lib/adminAccess";
import { COUNTRIES, type CountryCode } from "@/lib/countries";

const STORE_KEY = "diesel-price-overrides";

export interface DieselPriceOverride {
  value: number;
  asOf: string;
}

type OverridesMap = Partial<Record<CountryCode, DieselPriceOverride>>;

/**
 * Public read — diesel price isn't sensitive, and every calculator needs
 * this to pre-fill correctly. Only the write below is gated. Returns
 * `persistent: false` when running on the in-memory fallback store, so
 * the admin UI can show an honest "changes won't survive a redeploy"
 * notice rather than implying durability it doesn't have yet.
 */
export async function GET() {
  const store = getStore();
  const overrides = (await store.get<OverridesMap>(STORE_KEY)) ?? {};
  return NextResponse.json({ ok: true, overrides, persistent: store.persistent });
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { countryCode?: string; value?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const countryCode = body.countryCode as CountryCode | undefined;
  const value = body.value;
  if (!countryCode || !(countryCode in COUNTRIES) || typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const store = getStore();
  const overrides = (await store.get<OverridesMap>(STORE_KEY)) ?? {};
  overrides[countryCode] = { value, asOf: new Date().toISOString().slice(0, 10) };
  await store.set(STORE_KEY, overrides);

  return NextResponse.json({ ok: true, overrides, persistent: store.persistent });
}
