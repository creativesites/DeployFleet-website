import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/adminAccess";
import { getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { LEAD_STATUSES } from "@/lib/leadTypes";

const DAY_MS = 24 * 60 * 60 * 1000;
// Bounded fetch for the top-paths/unique-visitors breakdown — cheap
// aggregation via Firestore's own .count() covers the raw totals below;
// this is only for the "what pages, how many distinct visitors" detail,
// which needs the actual docs, not just a count.
const RECENT_PAGEVIEW_FETCH_LIMIT = 5000;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const db = getAdminFirestore();
  const now = Date.now();
  const since7d = Timestamp.fromMillis(now - 7 * DAY_MS);
  const since30d = Timestamp.fromMillis(now - 30 * DAY_MS);

  const [totalPageviewsSnap, last7dCountSnap, last30dDocsSnap, totalLeadsSnap, leadStatusCounts] = await Promise.all([
    db.collection("pageviews").count().get(),
    db.collection("pageviews").where("createdAt", ">=", since7d).count().get(),
    db
      .collection("pageviews")
      .where("createdAt", ">=", since30d)
      .orderBy("createdAt", "desc")
      .limit(RECENT_PAGEVIEW_FETCH_LIMIT)
      .get(),
    db.collection("leads").count().get(),
    Promise.all(
      LEAD_STATUSES.map(async (status) => ({
        status,
        count: (await db.collection("leads").where("status", "==", status).count().get()).data().count,
      }))
    ),
  ]);

  const last30dDocs = last30dDocsSnap.docs.map((doc) => doc.data());
  const uniqueVisitorsLast30Days = new Set(last30dDocs.map((d) => d.visitorId)).size;

  const pathCounts = new Map<string, number>();
  for (const doc of last30dDocs) {
    const path = (doc.path as string) ?? "unknown";
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
  }
  const topPaths = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  return NextResponse.json({
    ok: true,
    pageviews: {
      totalAllTime: totalPageviewsSnap.data().count,
      last7Days: last7dCountSnap.data().count,
      last30Days: last30dDocs.length,
      uniqueVisitorsLast30Days,
      topPaths,
    },
    leads: {
      totalAllTime: totalLeadsSnap.data().count,
      byStatus: leadStatusCounts,
    },
  });
}
