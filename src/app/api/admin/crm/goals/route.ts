import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { getGoalsConfig, saveGoalsConfig } from "@/lib/goals";
import { DAILY_GOAL_FIELDS, type DailyGoalSet, type Weekday } from "@/lib/crmTypes";
import { getStore } from "@/lib/adminStore";

/**
 * Revenue OS RS-0 §4.3 — the editable daily-goals config. Read + write are
 * both admin-gated (unlike diesel price, goals aren't public). `persistent`
 * is surfaced so the settings UI can show the same honest "won't survive a
 * redeploy on the in-memory store" notice the diesel editor already shows.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const config = await getGoalsConfig();
  return NextResponse.json({ ok: true, config, persistent: getStore().persistent });
}

function coerceGoalSet(raw: unknown): DailyGoalSet | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const out = {} as DailyGoalSet;
  for (const { key } of DAILY_GOAL_FIELDS) {
    const value = record[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1000) return null;
    out[key] = Math.round(value);
  }
  return out;
}

function coerceOverrides(raw: unknown): Partial<Record<Weekday, Partial<DailyGoalSet>>> | null {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const out: Partial<Record<Weekday, Partial<DailyGoalSet>>> = {};
  for (const [dayKey, value] of Object.entries(record)) {
    const day = Number(dayKey);
    if (!Number.isInteger(day) || day < 0 || day > 6) return null;
    if (typeof value !== "object" || value === null) return null;
    const valueRecord = value as Record<string, unknown>;
    const partial: Partial<DailyGoalSet> = {};
    for (const { key } of DAILY_GOAL_FIELDS) {
      const num = valueRecord[key];
      if (num === undefined) continue;
      if (typeof num !== "number" || !Number.isFinite(num) || num < 0 || num > 1000) return null;
      partial[key] = Math.round(num);
    }
    // An override with no fields set is equivalent to no override — skip it.
    if (Object.keys(partial).length > 0) out[day as Weekday] = partial;
  }
  return out;
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { default?: unknown; overrides?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const defaults = coerceGoalSet(body.default);
  const overrides = coerceOverrides(body.overrides);
  if (!defaults || !overrides) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const config = await saveGoalsConfig({ default: defaults, overrides });
  return NextResponse.json({ ok: true, config, persistent: getStore().persistent });
}
