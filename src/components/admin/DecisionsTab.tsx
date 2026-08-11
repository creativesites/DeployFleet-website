"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Decision, DecisionScope, DecisionStatus } from "@/lib/crmTypes";

type ScopeFilter = "all" | "global" | "prospect" | "employee";

function scopeLabel(scope: DecisionScope): string {
  if (scope.type === "global") return "Global";
  if (scope.type === "prospect") return `Prospect`;
  return `Employee`;
}

/** Phase 1 §4.4/§7.4 — the Decision Ledger's flat, filterable UI. Decisions are never edited in place; "Supersede" creates a replacement and links both directions. */
export default function DecisionsTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | DecisionStatus>("active");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  const [showForm, setShowForm] = useState(false);
  const [decisionText, setDecisionText] = useState("");
  const [reason, setReason] = useState("");
  const [scopeType, setScopeType] = useState<"global" | "prospect" | "employee">("global");
  const [scopeId, setScopeId] = useState("");
  const [evidence, setEvidence] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [supersedingId, setSupersedingId] = useState<string | null>(null);
  const [supersedeText, setSupersedeText] = useState("");
  const [supersedeReason, setSupersedeReason] = useState("");
  const [superseding, setSuperseding] = useState(false);

  function reload() {
    fetch("/api/admin/crm/decisions")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setDecisions(data.decisions);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => setError("network_error"));
  }

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    reload();
  }, [firebaseAdminConfigured]);

  async function createDecision(e: FormEvent) {
    e.preventDefault();
    if (!decisionText.trim() || !reason.trim()) return;
    if (scopeType !== "global" && !scopeId.trim()) return;
    setCreating(true);
    setCreateError(null);

    const scope: DecisionScope =
      scopeType === "global" ? { type: "global" } : scopeType === "prospect" ? { type: "prospect", prospectId: scopeId.trim() } : { type: "employee", employeeId: scopeId.trim() };

    const res = await fetch("/api/admin/crm/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionText: decisionText.trim(),
        reason: reason.trim(),
        scope,
        evidence: evidence
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        madeBy: "winston",
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.ok) {
      setDecisionText("");
      setReason("");
      setEvidence("");
      setScopeId("");
      setShowForm(false);
      reload();
    } else {
      setCreateError(data.reason ?? "unknown_error");
    }
  }

  async function supersede(id: string, scope: DecisionScope) {
    if (!supersedeText.trim() || !supersedeReason.trim()) return;
    setSuperseding(true);
    try {
      await fetch(`/api/admin/crm/decisions/${id}/supersede`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionText: supersedeText.trim(), reason: supersedeReason.trim(), scope, madeBy: "winston" }),
      });
      setSupersedingId(null);
      setSupersedeText("");
      setSupersedeReason("");
      reload();
    } finally {
      setSuperseding(false);
    }
  }

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see decisions. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load decisions ({error}).</p>;
  if (!decisions) return <p className="text-sm text-muted">Loading…</p>;

  const byId = new Map(decisions.map((d) => [d.id, d]));
  const filtered = decisions
    .filter((d) => statusFilter === "all" || d.status === statusFilter)
    .filter((d) => scopeFilter === "all" || d.scope.type === scopeFilter);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | DecisionStatus)}
          className="rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
        >
          <option value="active">Active</option>
          <option value="superseded">Superseded</option>
          <option value="all">All</option>
        </select>
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
          className="rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
        >
          <option value="all">All scopes</option>
          <option value="global">Global</option>
          <option value="prospect">Prospect</option>
          <option value="employee">Employee</option>
        </select>
        <button type="button" onClick={() => setShowForm((s) => !s)} className="btn-secondary ml-auto text-sm">
          {showForm ? "Cancel" : "New decision"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createDecision} className="card-surface mt-4 space-y-3 p-4">
          <div>
            <label htmlFor="decision-text" className="text-xs font-medium text-navy">
              Decision
            </label>
            <input
              id="decision-text"
              value={decisionText}
              onChange={(e) => setDecisionText(e.target.value)}
              placeholder="e.g. Prioritize trucking companies with 15+ vehicles"
              required
              className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
            />
          </div>
          <div>
            <label htmlFor="decision-reason" className="text-xs font-medium text-navy">
              Reason
            </label>
            <input
              id="decision-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="decision-scope" className="text-xs font-medium text-navy">
                Scope
              </label>
              <select
                id="decision-scope"
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value as "global" | "prospect" | "employee")}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              >
                <option value="global">Global</option>
                <option value="prospect">Prospect</option>
                <option value="employee">Employee</option>
              </select>
            </div>
            {scopeType !== "global" && (
              <div>
                <label htmlFor="decision-scope-id" className="text-xs font-medium text-navy">
                  {scopeType === "prospect" ? "Prospect ID" : "Employee ID"}
                </label>
                <input
                  id="decision-scope-id"
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  placeholder="paste the id from the URL"
                  required
                  className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
                />
              </div>
            )}
          </div>
          <div>
            <label htmlFor="decision-evidence" className="text-xs font-medium text-navy">
              Evidence (comma-separated, optional)
            </label>
            <input
              id="decision-evidence"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
            />
          </div>
          {createError && <p className="text-xs text-danger">Couldn&apos;t create decision ({createError}).</p>}
          <button type="submit" disabled={creating} className="btn-primary text-sm disabled:opacity-50">
            {creating ? "Creating…" : "Create decision"}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No decisions match this filter.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((d) => (
            <div key={d.id} className={`card-surface p-4 ${d.status === "superseded" ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-navy">{d.decisionText}</p>
                  <p className="mt-1 text-sm text-body">{d.reason}</p>
                  <p className="mt-1 text-xs text-muted">
                    {scopeLabel(d.scope)}
                    {d.scope.type === "prospect" && (
                      <>
                        {" — "}
                        <Link href={`/admin/prospects/${d.scope.prospectId}`} className="text-teal hover:underline">
                          view prospect
                        </Link>
                      </>
                    )}
                    {d.scope.type === "employee" && (
                      <>
                        {" — "}
                        <Link href={`/admin/team/${d.scope.employeeId}`} className="text-teal hover:underline">
                          view employee
                        </Link>
                      </>
                    )}
                    {" · "}
                    {d.madeBy} · {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                  {d.evidence.length > 0 && <p className="mt-1 text-xs text-muted">Evidence: {d.evidence.join(", ")}</p>}
                  {d.status === "superseded" && d.supersededBy && byId.has(d.supersededBy) && (
                    <p className="mt-1 text-xs text-teal">Superseded by: {byId.get(d.supersededBy)!.decisionText}</p>
                  )}
                </div>
                {d.status === "active" &&
                  (supersedingId === d.id ? null : (
                    <button type="button" onClick={() => setSupersedingId(d.id)} className="text-xs text-teal hover:underline">
                      Supersede
                    </button>
                  ))}
              </div>

              {supersedingId === d.id && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <input
                    value={supersedeText}
                    onChange={(e) => setSupersedeText(e.target.value)}
                    placeholder="Replacement decision text"
                    className="w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
                  />
                  <input
                    value={supersedeReason}
                    onChange={(e) => setSupersedeReason(e.target.value)}
                    placeholder="Reason"
                    className="w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => supersede(d.id, d.scope)}
                      disabled={superseding}
                      className="btn-primary text-xs disabled:opacity-50"
                    >
                      {superseding ? "Saving…" : "Confirm supersede"}
                    </button>
                    <button type="button" onClick={() => setSupersedingId(null)} className="btn-secondary text-xs">
                      Cancel
                    </button>
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
