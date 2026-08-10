"use client";

import { useEffect, useState } from "react";
import { LEAD_STATUSES, type LeadSource, type LeadStatus } from "@/lib/leadTypes";

type Lead = {
  id: string;
  name: string;
  company: string;
  phone: string;
  fleetSize: string | null;
  message: string | null;
  source: string;
  status: string;
  createdAt: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  "contact-form": "Contact form",
  "homepage-cta": "Homepage CTA",
  "demo-gate": "Demo gate",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  "demo-booked": "Demo booked",
  customer: "Customer",
  lost: "Lost",
};

export default function LeadsTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"" | LeadSource>("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    const url = sourceFilter ? `/api/admin/leads?source=${sourceFilter}` : "/api/admin/leads";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setLeads(data.leads);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => {
        if (!cancelled) setError("network_error");
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminConfigured, sourceFilter]);

  async function updateStatus(id: string, status: LeadStatus) {
    setSavingId(id);
    const res = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setLeads((prev) => prev?.map((lead) => (lead.id === id ? { ...lead, status } : lead)) ?? null);
    }
    setSavingId(null);
  }

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see leads. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load leads ({error}).</p>;
  if (!leads) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <div className="flex items-center gap-2">
        <label htmlFor="source-filter" className="text-sm font-medium text-navy">
          Source
        </label>
        <select
          id="source-filter"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as "" | LeadSource)}
          className="rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
        >
          <option value="">All</option>
          <option value="contact-form">Contact form</option>
          <option value="homepage-cta">Homepage CTA</option>
          <option value="demo-gate">Demo gate</option>
        </select>
      </div>

      {leads.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No leads yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {leads.map((lead) => (
            <div key={lead.id} className="card-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy">{lead.name}</p>
                  <p className="text-sm text-body">{lead.company}</p>
                  <p className="text-sm text-muted">{lead.phone}</p>
                  {lead.fleetSize && <p className="mt-1 text-xs text-muted">Fleet size: {lead.fleetSize}</p>}
                  {lead.message && <p className="mt-1 text-xs text-muted">&ldquo;{lead.message}&rdquo;</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full border border-border bg-canvas px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                    {SOURCE_LABEL[lead.source] ?? lead.source}
                  </span>
                  <select
                    value={lead.status}
                    disabled={savingId === lead.id}
                    onChange={(e) => updateStatus(lead.id, e.target.value as LeadStatus)}
                    className="rounded-df-md border border-border bg-canvas px-2.5 py-1.5 text-xs font-medium text-navy outline-none focus:border-teal"
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {lead.createdAt && (
                    <span className="text-[11px] text-muted">{new Date(lead.createdAt).toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
