"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AuditEvent, AuditEventActor } from "@/lib/crmTypes";

const ACTOR_LABEL: Record<AuditEventActor, string> = {
  winston: "Winston",
  ai_orchestrator: "AI Orchestrator",
  ai_reconciliation: "Reality Engine",
  ai_inbox_extraction: "AI Inbox",
};

/** Phase 2 §8.5 — a flat, filterable, chronological read of every AuditEvent every prior phase already writes to. */
export default function ActivityTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actorFilter, setActorFilter] = useState<"all" | AuditEventActor>("all");

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    fetch("/api/admin/crm/activity")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setEvents(data.events);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => setError("network_error"));
  }, [firebaseAdminConfigured]);

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see activity. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load activity ({error}).</p>;
  if (!events) return <p className="text-sm text-muted">Loading…</p>;

  const filtered = actorFilter === "all" ? events : events.filter((e) => e.actor === actorFilter);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActorFilter("all")}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${actorFilter === "all" ? "border-teal bg-teal/10 text-teal" : "border-border text-body hover:border-teal/50"}`}
        >
          All
        </button>
        {(Object.keys(ACTOR_LABEL) as AuditEventActor[]).map((actor) => (
          <button
            key={actor}
            type="button"
            onClick={() => setActorFilter(actor)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${actorFilter === actor ? "border-teal bg-teal/10 text-teal" : "border-border text-body hover:border-teal/50"}`}
          >
            {ACTOR_LABEL[actor]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing recorded yet{actorFilter !== "all" ? " for this actor" : ""}.</p>
      ) : (
        <div className="mt-4 space-y-1.5">
          {filtered.map((e) => (
            <div key={e.id} className="card-surface flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
              <div>
                <p className="text-navy">{e.summary}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {new Date(e.createdAt).toLocaleString()} · {ACTOR_LABEL[e.actor]}
                  {e.relatedProspectId && (
                    <>
                      {" · "}
                      <Link href={`/admin/prospects/${e.relatedProspectId}`} className="text-teal hover:underline">
                        prospect
                      </Link>
                    </>
                  )}
                  {e.relatedEmployeeId && (
                    <>
                      {" · "}
                      <Link href={`/admin/team/${e.relatedEmployeeId}`} className="text-teal hover:underline">
                        employee
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <span className="rounded-full border border-border bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                {e.eventType.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
