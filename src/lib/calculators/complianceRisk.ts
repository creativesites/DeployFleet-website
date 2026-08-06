export interface ComplianceItemInput {
  name: string;
  /** ISO date (YYYY-MM-DD) the document expires. */
  expiryDate: string;
  renewalCostZmw: number;
  /** What operating with this expired is estimated to risk, if caught — a fine, impoundment cost, etc. */
  estimatedPenaltyIfExpiredZmw: number;
}

export interface ComplianceRiskInputs {
  items: ComplianceItemInput[];
  /** ISO date (YYYY-MM-DD) to treat as "today" — passed in, never read from the system clock inside this function. */
  todayIso: string;
}

export type ComplianceStatus = "expired" | "expiring-soon" | "valid" | "invalid-date";

const EXPIRING_SOON_THRESHOLD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ComplianceItemResult extends ComplianceItemInput {
  daysUntilExpiry: number;
  status: ComplianceStatus;
}

export interface ComplianceRiskResult {
  items: ComplianceItemResult[];
  totalRenewalCostZmw: number;
  totalPenaltyExposureZmw: number;
  expiredCount: number;
  expiringSoonCount: number;
  validCount: number;
  soonestExpiring: ComplianceItemResult | null;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

export function calculateComplianceRisk(inputs: ComplianceRiskInputs): ComplianceRiskResult {
  const items: ComplianceItemResult[] = inputs.items.map((item) => {
    const daysUntilExpiry = daysBetween(inputs.todayIso, item.expiryDate);
    let status: ComplianceStatus;
    if (Number.isNaN(daysUntilExpiry)) {
      status = "invalid-date";
    } else if (daysUntilExpiry < 0) {
      status = "expired";
    } else if (daysUntilExpiry <= EXPIRING_SOON_THRESHOLD_DAYS) {
      status = "expiring-soon";
    } else {
      status = "valid";
    }
    return { ...item, daysUntilExpiry, status };
  });

  const totalRenewalCostZmw = items.reduce((sum, item) => sum + Math.max(0, item.renewalCostZmw), 0);
  const totalPenaltyExposureZmw = items
    .filter((item) => item.status === "expired")
    .reduce((sum, item) => sum + Math.max(0, item.estimatedPenaltyIfExpiredZmw), 0);

  const expiredCount = items.filter((item) => item.status === "expired").length;
  const expiringSoonCount = items.filter((item) => item.status === "expiring-soon").length;
  const validCount = items.filter((item) => item.status === "valid").length;

  const upcoming = items
    .filter((item) => item.status === "valid" || item.status === "expiring-soon")
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  const soonestExpiring = upcoming.length > 0 ? upcoming[0] : null;

  return {
    items,
    totalRenewalCostZmw,
    totalPenaltyExposureZmw,
    expiredCount,
    expiringSoonCount,
    validCount,
    soonestExpiring,
  };
}
