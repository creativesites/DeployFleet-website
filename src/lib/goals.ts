import "server-only";
import { getStore } from "./adminStore";
import {
  DEFAULT_DAILY_GOALS,
  DEFAULT_RANKING_WEIGHTS,
  RANKING_COMPONENT_META,
  type DailyGoalSet,
  type GoalsConfig,
  type RankingWeights,
  type Weekday,
} from "./crmTypes";

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

// ---------------------------------------------------------------------------
// Revenue OS RS-1 §5.7 — the editable prospect-ranking weights, stored via
// the same KeyValueStore under a sibling key (the doc's "extend GoalsConfig
// or a sibling RankingWeights key" — sibling chosen so goals and ranking
// stay independently editable and independently defaulting).
// ---------------------------------------------------------------------------

const RANKING_WEIGHTS_KEY = "RANKING_WEIGHTS";

export async function getRankingWeights(): Promise<RankingWeights> {
  const stored = await getStore().get<RankingWeights>(RANKING_WEIGHTS_KEY);
  if (!stored) return { ...DEFAULT_RANKING_WEIGHTS };
  // Backfill any component added after a config was first saved.
  const out = { ...DEFAULT_RANKING_WEIGHTS };
  for (const { key } of RANKING_COMPONENT_META) {
    if (typeof stored[key] === "number" && Number.isFinite(stored[key])) out[key] = stored[key];
  }
  return out;
}

export async function saveRankingWeights(weights: RankingWeights): Promise<RankingWeights> {
  await getStore().set(RANKING_WEIGHTS_KEY, weights);
  return weights;
}

export const RANKING_WEIGHTS_STORE_KEY = RANKING_WEIGHTS_KEY;
