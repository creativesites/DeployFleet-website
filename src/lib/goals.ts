import "server-only";
import { getStore } from "./adminStore";
import { DEFAULT_DAILY_GOALS, type DailyGoalSet, type GoalsConfig, type Weekday } from "./crmTypes";

/**
 * Revenue OS RS-0 §4.3 — the configurable daily/weekly goals, stored via
 * the same getStore() KeyValueStore (Upstash Redis when configured,
 * in-memory fallback otherwise) as diesel-price overrides. A small,
 * singleton, frequently-read config object — deliberately NOT a Firestore
 * collection, exactly the diesel-price precedent this reuses.
 *
 * The two shipped defaults (10 prospects / 5 meaningful) are the same
 * numbers the retired TARGET_ATTEMPTS_PER_DAY/TARGET_MEANINGFUL_PER_DAY
 * constants carried, so nothing about the weekly scoreboard's behavior
 * changes until Winston actually edits the config on the settings page.
 */

const GOALS_CONFIG_KEY = "GOALS_CONFIG";

export function defaultGoalsConfig(): GoalsConfig {
  return { default: { ...DEFAULT_DAILY_GOALS }, overrides: {}, updatedAt: new Date(0).toISOString() };
}

export async function getGoalsConfig(): Promise<GoalsConfig> {
  const stored = await getStore().get<GoalsConfig>(GOALS_CONFIG_KEY);
  if (!stored) return defaultGoalsConfig();
  // Backfill any goal key added after a config was first saved, so an old
  // stored object never yields `undefined` for a newly-introduced bucket.
  return {
    default: { ...DEFAULT_DAILY_GOALS, ...stored.default },
    overrides: stored.overrides ?? {},
    updatedAt: stored.updatedAt ?? new Date(0).toISOString(),
  };
}

export async function saveGoalsConfig(next: {
  default: DailyGoalSet;
  overrides: Partial<Record<Weekday, Partial<DailyGoalSet>>>;
}): Promise<GoalsConfig> {
  const config: GoalsConfig = { default: next.default, overrides: next.overrides, updatedAt: new Date().toISOString() };
  await getStore().set(GOALS_CONFIG_KEY, config);
  return config;
}

/** Resolve the effective goal set for a given weekday (0 = Sunday … 6 = Saturday) — the default merged with that weekday's partial override, if any. */
export function resolveGoalsForWeekday(config: GoalsConfig, weekday: Weekday): DailyGoalSet {
  const override = config.overrides[weekday];
  if (!override) return { ...config.default };
  return { ...config.default, ...override };
}

/** Resolve the effective goal set for a plain YYYY-MM-DD date (UTC weekday). */
export function resolveGoalsForDate(config: GoalsConfig, isoDate: string): DailyGoalSet {
  const weekday = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay() as Weekday;
  return resolveGoalsForWeekday(config, weekday);
}

export const GOALS_STORE_KEY = GOALS_CONFIG_KEY;
