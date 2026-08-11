"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Campaign, Prospect } from "@/lib/crmTypes";

interface CampaignScoreboard {
  campaign: Campaign;
  prospectCount: number;
  attempts: number;
  meaningful: number;
}

/**
 * Phase 0 §6.3 — "Outreach" in the UI (named to avoid colliding with the
 * separate Visitor Intelligence /admin/campaigns route, which tracks
 * website traffic channels, not DeployFleet's own outbound batches).
 */
export default function OutreachTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scoreboard, setScoreboard] = useState<CampaignScoreboard | null>(null);
  const [unassigned, setUnassigned] = useState<Prospect[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [targetAttempts, setTargetAttempts] = useState("");
  const [targetMeaningful, setTargetMeaningful] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function reload() {
    fetch("/api/admin/crm/campaigns")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setCampaigns(data.campaigns);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => setError("network_error"));
  }

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    reload();
  }, [firebaseAdminConfigured]);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setScoreboard(null);
      setUnassigned(null);
      setSelected(new Set());
      return;
    }
    setExpandedId(id);
    setScoreboard(null);
    setUnassigned(null);
    setSelected(new Set());

    const [scoreRes, prospectsRes] = await Promise.all([
      fetch(`/api/admin/crm/campaigns/${id}`),
      fetch("/api/admin/crm/prospects"),
    ]);
    const scoreData = await scoreRes.json();
    if (scoreData.ok) setScoreboard(scoreData);
    const prospectsData = await prospectsRes.json();
    if (prospectsData.ok) {
      setUnassigned((prospectsData.prospects as Prospect[]).filter((p) => !p.campaignId));
    }
  }

  async function assignSelected(campaignId: string) {
    if (selected.size === 0) return;
    setAssigning(true);
    await Promise.all(
      Array.from(selected).map((prospectId) =>
        fetch(`/api/admin/crm/prospects/${prospectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId }),
        })
      )
    );
    setSelected(new Set());

    const [scoreRes, prospectsRes] = await Promise.all([
      fetch(`/api/admin/crm/campaigns/${campaignId}`),
      fetch("/api/admin/crm/prospects"),
    ]);
    const scoreData = await scoreRes.json();
    if (scoreData.ok) setScoreboard(scoreData);
    const prospectsData = await prospectsRes.json();
    if (prospectsData.ok) {
      setUnassigned((prospectsData.prospects as Prospect[]).filter((p) => !p.campaignId));
    }
    setAssigning(false);
  }

  async function createCampaign(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/admin/crm/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        startDate,
        endDate: endDate || null,
        targetAttempts: targetAttempts ? Number(targetAttempts) : null,
        targetMeaningfulInteractions: targetMeaningful ? Number(targetMeaningful) : null,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.ok) {
      setName("");
      setEndDate("");
      setTargetAttempts("");
      setTargetMeaningful("");
      setShowForm(false);
      reload();
    } else {
      setCreateError(data.reason ?? "unknown_error");
    }
  }

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see outreach campaigns. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load campaigns ({error}).</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Batches of outbound activity, each with its own attempt/meaningful-interaction targets.</p>
        <button type="button" onClick={() => setShowForm((s) => !s)} className="btn-secondary text-sm">
          {showForm ? "Cancel" : "New campaign"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createCampaign} className="card-surface mt-4 space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="campaign-name" className="text-xs font-medium text-navy">
                Name
              </label>
              <input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. August Outbound Offensive"
                required
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="campaign-start" className="text-xs font-medium text-navy">
                Start date
              </label>
              <input
                id="campaign-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="campaign-end" className="text-xs font-medium text-navy">
                End date (optional)
              </label>
              <input
                id="campaign-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div />
            <div>
              <label htmlFor="campaign-target-attempts" className="text-xs font-medium text-navy">
                Target attempts (optional)
              </label>
              <input
                id="campaign-target-attempts"
                type="number"
                min={0}
                value={targetAttempts}
                onChange={(e) => setTargetAttempts(e.target.value)}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="campaign-target-meaningful" className="text-xs font-medium text-navy">
                Target meaningful interactions (optional)
              </label>
              <input
                id="campaign-target-meaningful"
                type="number"
                min={0}
                value={targetMeaningful}
                onChange={(e) => setTargetMeaningful(e.target.value)}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
          </div>
          {createError && <p className="text-xs text-danger">Couldn&apos;t create campaign ({createError}).</p>}
          <button type="submit" disabled={creating} className="btn-primary text-sm disabled:opacity-50">
            {creating ? "Creating…" : "Create campaign"}
          </button>
        </form>
      )}

      {!campaigns ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : campaigns.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No campaigns yet — click &quot;New campaign&quot; above to create one.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="card-surface p-4">
              <button type="button" onClick={() => toggleExpand(c.id)} className="w-full text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{c.name}</p>
                    <p className="text-xs text-muted">
                      {c.startDate}
                      {c.endDate ? ` → ${c.endDate}` : ""} · {c.status}
                    </p>
                  </div>
                  {(c.targetAttempts !== null || c.targetMeaningfulInteractions !== null) && (
                    <p className="text-xs text-muted">
                      Target: {c.targetAttempts ?? "—"} attempts / {c.targetMeaningfulInteractions ?? "—"} meaningful
                    </p>
                  )}
                </div>
              </button>

              {expandedId === c.id && (
                <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
                  {!scoreboard ? (
                    <p className="text-muted">Loading scoreboard…</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-df-md border border-border bg-canvas p-3 text-center">
                        <p className="text-lg font-semibold text-navy">{scoreboard.prospectCount}</p>
                        <p className="text-[11px] text-muted">Prospects</p>
                      </div>
                      <div className="rounded-df-md border border-border bg-canvas p-3 text-center">
                        <p className="text-lg font-semibold text-navy">{scoreboard.attempts}</p>
                        <p className="text-[11px] text-muted">Attempts</p>
                      </div>
                      <div className="rounded-df-md border border-border bg-canvas p-3 text-center">
                        <p className="text-lg font-semibold text-navy">{scoreboard.meaningful}</p>
                        <p className="text-[11px] text-muted">Meaningful</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Assign prospects</p>
                    {!unassigned ? (
                      <p className="mt-2 text-muted">Loading…</p>
                    ) : unassigned.length === 0 ? (
                      <p className="mt-2 text-muted">No unassigned prospects.</p>
                    ) : (
                      <>
                        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-df-md border border-border p-2">
                          {unassigned.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs text-body hover:bg-canvas">
                              <input
                                type="checkbox"
                                checked={selected.has(p.id)}
                                onChange={(e) => {
                                  setSelected((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(p.id);
                                    else next.delete(p.id);
                                    return next;
                                  });
                                }}
                              />
                              {p.name}
                            </label>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => assignSelected(c.id)}
                          disabled={assigning || selected.size === 0}
                          className="btn-secondary mt-2 text-xs disabled:opacity-50"
                        >
                          {assigning ? "Assigning…" : `Assign ${selected.size || ""} selected`}
                        </button>
                      </>
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
