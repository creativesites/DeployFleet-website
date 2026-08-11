"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { INBOX_SOURCE_TYPE_LABEL, type InboxEntry } from "@/lib/crmTypes";
import InboxPasteBox from "./InboxPasteBox";

/**
 * Phase 1 §7.1 — the dedicated AI Inbox page: a general, unscoped paste
 * box (review-and-apply happens immediately, same as the Prospect/
 * Employee-page paste boxes) plus a read-only history of everything
 * pasted anywhere in the system, newest first.
 */
export default function InboxTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [entries, setEntries] = useState<InboxEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    fetch("/api/admin/crm/inbox")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setEntries(data.entries);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => setError("network_error"));
  }

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    reload();
  }, [firebaseAdminConfigured]);

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to use the Inbox. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  return (
    <div>
      <InboxPasteBox onApplied={reload} />

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">History</p>
        {error ? (
          <p className="mt-2 text-sm text-danger">Couldn&apos;t load history ({error}).</p>
        ) : !entries ? (
          <p className="mt-2 text-sm text-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing pasted yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="card-surface p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-muted">
                    {new Date(e.createdAt).toLocaleString()} · {INBOX_SOURCE_TYPE_LABEL[e.sourceType]}
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      e.reviewedByWinston ? "bg-teal/10 text-teal" : e.extractionStatus === "failed" ? "bg-danger/10 text-danger" : "bg-canvas text-muted"
                    }`}
                  >
                    {e.reviewedByWinston ? "Applied" : e.extractionStatus === "failed" ? "Extraction failed" : "Awaiting review"}
                  </span>
                </div>
                <p className="mt-1 text-body">{e.rawText.slice(0, 240)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
