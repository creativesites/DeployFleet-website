"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  INTERACTION_OUTCOME_LABEL,
  INTERACTION_TYPE_LABEL,
  PIPELINE_STAGE_LABEL,
  PIPELINE_STAGES,
  PROSPECT_SOURCE_LABEL,
  type Interaction,
  type PipelineStage,
  type Prospect,
  type ProspectSource,
} from "@/lib/crmTypes";

const EMPTY_FORM = {
  name: "",
  contactName: "",
  contactRole: "",
  contactPhone: "",
  contactWhatsapp: "",
  contactEmail: "",
  location: "",
  estimatedFleetSizeRaw: "",
  primaryPainRaw: "",
  source: "other" as ProspectSource,
};

export default function ProspectsTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<"" | PipelineStage>("");
  const [sourceFilter, setSourceFilter] = useState<"" | ProspectSource>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Interaction[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (stageFilter !== "") params.set("stage", String(stageFilter));
    if (sourceFilter) params.set("source", sourceFilter);
    fetch(`/api/admin/crm/prospects?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setProspects(data.prospects);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => {
        if (!cancelled) setError("network_error");
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminConfigured, stageFilter, sourceFilter, refreshKey]);

  async function createProspect(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/admin/crm/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        contactName: form.contactName || null,
        contactRole: form.contactRole || null,
        contactPhone: form.contactPhone || null,
        contactWhatsapp: form.contactWhatsapp || null,
        contactEmail: form.contactEmail || null,
        location: form.location || null,
        estimatedFleetSizeRaw: form.estimatedFleetSizeRaw || null,
        primaryPainRaw: form.primaryPainRaw || null,
        source: form.source,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.ok) {
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      setRefreshKey((k) => k + 1);
    } else {
      setCreateError(data.reason ?? "unknown_error");
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setInteractions(null);
      return;
    }
    setExpandedId(id);
    setInteractions(null);
    const res = await fetch(`/api/admin/crm/prospects/${id}`);
    const data = await res.json();
    if (data.ok) setInteractions(data.interactions);
  }

  async function runSync() {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch("/api/admin/crm/sync", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      setSyncResult(
        `Outbound list: ${data.seed.created} added, ${data.seed.skipped} already there. Website leads: ${data.leads.promoted} promoted.`
      );
      setStageFilter((s) => s); // trigger a refetch
    } else {
      setSyncResult(`Sync failed: ${data.reason ?? "unknown_error"}`);
    }
    setSyncing(false);
  }

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see prospects. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load prospects ({error}).</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="prospect-stage-filter" className="text-sm font-medium text-navy">
            Stage
          </label>
          <select
            id="prospect-stage-filter"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value === "" ? "" : (Number(e.target.value) as PipelineStage))}
            className="rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
          >
            <option value="">All</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="prospect-source-filter" className="text-sm font-medium text-navy">
            Source
          </label>
          <select
            id="prospect-source-filter"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as "" | ProspectSource)}
            className="rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
          >
            <option value="">All</option>
            {Object.entries(PROSPECT_SOURCE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => setShowAddForm((s) => !s)} className="btn-secondary ml-auto text-sm">
          {showAddForm ? "Cancel" : "Add prospect"}
        </button>
        <button type="button" onClick={runSync} disabled={syncing} className="btn-secondary text-sm disabled:opacity-50">
          {syncing ? "Syncing…" : "Seed outbound list + sync leads"}
        </button>
      </div>

      {syncResult && <p className="mt-3 text-xs text-muted">{syncResult}</p>}

      {showAddForm && (
        <form onSubmit={createProspect} className="card-surface mt-4 space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="add-name" className="text-xs font-medium text-navy">
                Company name
              </label>
              <input
                id="add-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="add-contact-name" className="text-xs font-medium text-navy">
                Contact name
              </label>
              <input
                id="add-contact-name"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="add-contact-role" className="text-xs font-medium text-navy">
                Contact role
              </label>
              <input
                id="add-contact-role"
                value={form.contactRole}
                onChange={(e) => setForm((f) => ({ ...f, contactRole: e.target.value }))}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="add-source" className="text-xs font-medium text-navy">
                Source
              </label>
              <select
                id="add-source"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as ProspectSource }))}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              >
                {Object.entries(PROSPECT_SOURCE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="add-phone" className="text-xs font-medium text-navy">
                Phone
              </label>
              <input
                id="add-phone"
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                placeholder="+260 9..."
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="add-whatsapp" className="text-xs font-medium text-navy">
                WhatsApp (if different)
              </label>
              <input
                id="add-whatsapp"
                value={form.contactWhatsapp}
                onChange={(e) => setForm((f) => ({ ...f, contactWhatsapp: e.target.value }))}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="add-email" className="text-xs font-medium text-navy">
                Email
              </label>
              <input
                id="add-email"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="add-location" className="text-xs font-medium text-navy">
                Location
              </label>
              <input
                id="add-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="add-fleet-size" className="text-xs font-medium text-navy">
                Estimated fleet size
              </label>
              <input
                id="add-fleet-size"
                value={form.estimatedFleetSizeRaw}
                onChange={(e) => setForm((f) => ({ ...f, estimatedFleetSizeRaw: e.target.value }))}
                placeholder="e.g. 5-10 trucks"
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="add-pain" className="text-xs font-medium text-navy">
                Primary pain (if known)
              </label>
              <input
                id="add-pain"
                value={form.primaryPainRaw}
                onChange={(e) => setForm((f) => ({ ...f, primaryPainRaw: e.target.value }))}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
          </div>
          {createError && <p className="text-xs text-danger">Couldn&apos;t create prospect ({createError}).</p>}
          <button type="submit" disabled={creating} className="btn-primary text-sm disabled:opacity-50">
            {creating ? "Adding…" : "Add prospect"}
          </button>
        </form>
      )}

      {!prospects ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : prospects.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No prospects yet — click &quot;Seed outbound list + sync leads&quot; above to import the 52-company
          outbound list and promote any un-promoted website leads.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {prospects.map((p) => (
            <div key={p.id} className="card-surface p-4">
              <button type="button" onClick={() => toggleExpand(p.id)} className="w-full text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{p.name}</p>
                    <p className="text-sm text-body">
                      {p.contactName ?? "No contact name"} {p.contactPhone ? `· ${p.contactPhone}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {PIPELINE_STAGE_LABEL[p.stage]} · {PROSPECT_SOURCE_LABEL[p.source]}
                      {p.nextActionDate && ` · next: ${p.nextActionDate}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {p.priorityScore !== null && (
                      <span className="rounded-full border border-border bg-canvas px-2.5 py-1 text-[11px] font-medium text-navy">
                        Priority {p.priorityScore}
                      </span>
                    )}
                    {p.visitorSnapshot && (
                      <span className="rounded-full border border-teal/40 bg-teal/10 px-2.5 py-1 text-[11px] font-medium text-teal">
                        Website-linked
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {expandedId === p.id && (
                <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
                  <Link href={`/admin/prospects/${p.id}`} className="text-xs font-semibold text-teal hover:underline">
                    View full profile →
                  </Link>
                  {p.location && (
                    <p>
                      <span className="font-medium text-navy">Location:</span> <span className="text-body">{p.location}</span>
                    </p>
                  )}
                  {p.estimatedFleetSizeRaw && (
                    <p>
                      <span className="font-medium text-navy">Estimated fleet:</span>{" "}
                      <span className="text-body">{p.estimatedFleetSizeRaw}</span>
                    </p>
                  )}
                  {p.primaryPainRaw && (
                    <p>
                      <span className="font-medium text-navy">Primary pain:</span>{" "}
                      <span className="text-body">{p.primaryPainRaw}</span>
                    </p>
                  )}
                  {p.phoneClassification && (
                    <p className="text-xs text-muted">
                      Phone: {p.phoneClassification.type}
                      {p.phoneClassification.carrier ? ` (${p.phoneClassification.carrier})` : ""} — recommended{" "}
                      {p.phoneClassification.recommendedChannel}
                      {p.phoneClassification.patternAnomaly && " · pattern anomaly flagged"}
                    </p>
                  )}

                  {p.intelligence.summary && (
                    <div className="rounded-df-md border border-border bg-canvas p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">AI brief</p>
                      <p className="mt-1 text-body">{p.intelligence.summary.value}</p>
                      {p.intelligence.recommendedWedge && (
                        <p className="mt-1 text-navy">
                          <span className="font-medium">Wedge:</span> {p.intelligence.recommendedWedge.value}
                        </p>
                      )}
                    </div>
                  )}

                  {p.visitorSnapshot && (
                    <div className="rounded-df-md border border-teal/30 bg-teal/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal">Website activity (at promotion)</p>
                      <p className="mt-1 text-navy">
                        {p.visitorSnapshot.totalSessions} sessions · {p.visitorSnapshot.totalPageViews} page views ·
                        engagement {p.visitorSnapshot.engagementScore}/100 · intent {p.visitorSnapshot.intentScore}/100
                      </p>
                      {p.visitorSnapshot.topPages.length > 0 && (
                        <p className="mt-1 text-xs text-muted">Top pages: {p.visitorSnapshot.topPages.join(", ")}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Interaction history</p>
                    {!interactions ? (
                      <p className="mt-2 text-muted">Loading…</p>
                    ) : interactions.length === 0 ? (
                      <p className="mt-2 text-muted">No interactions logged yet.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {interactions.map((i) => (
                          <div key={i.id} className="text-xs">
                            <span className="text-muted">{new Date(i.createdAt).toLocaleString()}</span>{" "}
                            <span className="font-medium text-navy">{INTERACTION_TYPE_LABEL[i.type]}</span>
                            {i.outcome && <span className="text-body"> — {INTERACTION_OUTCOME_LABEL[i.outcome]}</span>}
                            {i.rawNote && <p className="mt-0.5 text-body">&ldquo;{i.rawNote}&rdquo;</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
