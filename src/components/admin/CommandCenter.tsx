"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChatInput from "./ChatInput";
import type { InboxEntry, Prospect } from "@/lib/crmTypes";

interface SystemState {
  computedAt: string;
  currentCampaign: { id: string; name: string; attempts: number; meaningful: number } | null;
  todayAttempts: number;
  todayMeaningful: number;
  targetAttemptsPerDay: number;
  targetMeaningfulPerDay: number;
  overdueProspectCount: number;
  biggestBottleneck: string | null;
  topProspect: { id: string; name: string; opportunityScore: number } | null;
  topRisk: { flag: string; count: number } | null;
}

interface AiEmployeeLite {
  id: string;
  name: string;
  status: "active" | "paused";
}

interface OrchestratorProposal {
  tool: string;
  args: Record<string, unknown>;
  description: string;
}

interface OrchestratorToolLogEntry {
  tool: string;
  resultSummary: string;
}

interface OrchestratorResponse {
  ok: boolean;
  text: string;
  toolLog: OrchestratorToolLogEntry[];
  proposals: OrchestratorProposal[];
  reason?: string;
}

const STALE_EMPLOYEE_DAYS = 7;

/** Proposals for a prospect stage change past "Qualified Opportunity" (index 5+) are never one-click-approvable — §8.2 Level 4, always human-required, regardless of update_prospect's own Level 0 default. */
function isHighStakesStageChange(p: OrchestratorProposal): boolean {
  if (p.tool !== "update_prospect") return false;
  const stage = Number(p.args.stage);
  return Number.isFinite(stage) && stage >= 5;
}

/** Phase 2 §8.4 — the AI Command Center. Sits above the existing Visitor Intelligence Overview stats on /admin, not a new route. */
export default function CommandCenter({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [state, setState] = useState<SystemState | null>(null);
  const [dueTodayCount, setDueTodayCount] = useState<number | null>(null);
  const [staleEmployees, setStaleEmployees] = useState<AiEmployeeLite[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [asking, setAsking] = useState(false);
  const [response, setResponse] = useState<OrchestratorResponse | null>(null);
  const [approving, setApproving] = useState<number | null>(null);
  const [approvedIndexes, setApprovedIndexes] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!firebaseAdminConfigured) return;

    const today = new Date().toISOString().slice(0, 10);

    Promise.all([
      fetch("/api/admin/crm/system-state").then((r) => r.json()),
      fetch(`/api/admin/crm/prospects?dueBy=${today}`).then((r) => r.json()),
      fetch("/api/admin/crm/employees").then((r) => r.json()),
      fetch("/api/admin/crm/inbox").then((r) => r.json()),
    ])
      .then(([stateData, prospectsData, employeesData, inboxData]) => {
        if (stateData.ok) setState(stateData.state);
        if (prospectsData.ok) setDueTodayCount((prospectsData.prospects as Prospect[]).length);

        if (employeesData.ok && inboxData.ok) {
          const lastEntryByEmployee = new Map<string, string>();
          for (const entry of inboxData.entries as InboxEntry[]) {
            if (!entry.relatedEmployeeId) continue;
            const existing = lastEntryByEmployee.get(entry.relatedEmployeeId);
            if (!existing || entry.createdAt > existing) lastEntryByEmployee.set(entry.relatedEmployeeId, entry.createdAt);
          }
          const staleThreshold = new Date(Date.now() - STALE_EMPLOYEE_DAYS * 24 * 60 * 60 * 1000).toISOString();
          const stale = (employeesData.employees as AiEmployeeLite[]).filter((e) => {
            if (e.status !== "active") return false;
            const lastEntry = lastEntryByEmployee.get(e.id);
            return !lastEntry || lastEntry < staleThreshold;
          });
          setStaleEmployees(stale);
        }
      })
      .catch(() => setLoadError("network_error"));
  }, [firebaseAdminConfigured]);

  async function ask() {
    if (!prompt.trim()) return;
    setAsking(true);
    setResponse(null);
    setApprovedIndexes(new Set());
    try {
      const res = await fetch("/api/admin/crm/orchestrator/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      setResponse(data);
    } catch {
      setResponse({ ok: false, text: "", toolLog: [], proposals: [], reason: "network_error" });
    } finally {
      setAsking(false);
    }
  }

  async function approve(index: number) {
    if (!response) return;
    const p = response.proposals[index];
    if (!p || isHighStakesStageChange(p)) return;
    setApproving(index);
    const headers = { "Content-Type": "application/json" };
    try {
      switch (p.tool) {
        case "create_task":
          await fetch("/api/admin/crm/tasks", {
            method: "POST",
            headers,
            body: JSON.stringify({
              title: p.args.title,
              description: p.args.description ?? null,
              relatedProspectId: p.args.relatedProspectId ?? null,
              dueDate: p.args.dueDate ?? null,
              priority: p.args.priority ?? "medium",
              createdBy: "ai_orchestrator",
            }),
          });
          break;
        case "update_task":
          await fetch(`/api/admin/crm/tasks/${p.args.taskId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status: p.args.status, dueDate: p.args.dueDate, priority: p.args.priority }),
          });
          break;
        case "complete_task":
          await fetch(`/api/admin/crm/tasks/${p.args.taskId}`, { method: "PATCH", headers, body: JSON.stringify({ status: "done" }) });
          break;
        case "create_prospect":
          await fetch("/api/admin/crm/prospects", {
            method: "POST",
            headers,
            body: JSON.stringify({
              name: p.args.name,
              location: p.args.location ?? null,
              estimatedFleetSizeRaw: p.args.estimatedFleetSizeRaw ?? null,
              primaryPainRaw: p.args.primaryPainRaw ?? null,
            }),
          });
          break;
        case "update_prospect": {
          const patch: Record<string, unknown> = {};
          if (typeof p.args.nextActionDate === "string") patch.nextActionDate = p.args.nextActionDate;
          if (typeof p.args.nextActionNote === "string") patch.nextActionNote = p.args.nextActionNote;
          await fetch(`/api/admin/crm/prospects/${p.args.prospectId}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
          break;
        }
        case "create_decision": {
          const scope =
            p.args.scopeType === "prospect"
              ? { type: "prospect", prospectId: p.args.scopeId }
              : p.args.scopeType === "employee"
                ? { type: "employee", employeeId: p.args.scopeId }
                : { type: "global" };
          await fetch("/api/admin/crm/decisions", {
            method: "POST",
            headers,
            body: JSON.stringify({ decisionText: p.args.decisionText, reason: p.args.reason, scope, madeBy: "ai_orchestrator" }),
          });
          break;
        }
        case "supersede_decision":
          await fetch(`/api/admin/crm/decisions/${p.args.decisionId}/supersede`, {
            method: "POST",
            headers,
            body: JSON.stringify({ decisionText: p.args.decisionText, reason: p.args.reason, scope: { type: "global" }, madeBy: "ai_orchestrator" }),
          });
          break;
        case "request_ai_employee_report":
          await fetch("/api/admin/crm/tasks", {
            method: "POST",
            headers,
            body: JSON.stringify({ title: p.args.title, relatedEmployeeId: p.args.employeeId, createdBy: "ai_orchestrator" }),
          });
          break;
      }
      setApprovedIndexes((prev) => new Set(prev).add(index));
    } finally {
      setApproving(null);
    }
  }

  if (!firebaseAdminConfigured) return null;

  const topActions: { label: string; href: string }[] = [];
  if (state && state.overdueProspectCount > 0) {
    topActions.push({ label: `Follow up with ${state.overdueProspectCount} overdue prospect(s)`, href: "/admin/today" });
  }
  if (state?.topProspect) {
    topActions.push({ label: `Push forward ${state.topProspect.name} (top opportunity)`, href: `/admin/prospects/${state.topProspect.id}` });
  }
  if (staleEmployees && staleEmployees.length > 0) {
    topActions.push({ label: `Check in with ${staleEmployees[0].name} — no update in ${STALE_EMPLOYEE_DAYS}+ days`, href: `/admin/team/${staleEmployees[0].id}` });
  }
  if (topActions.length < 3 && state?.currentCampaign) {
    topActions.push({ label: `Review "${state.currentCampaign.name}" campaign progress`, href: "/admin/outreach" });
  }
  if (topActions.length < 3) {
    topActions.push({ label: "Run the Reality & Reconciliation check", href: "/admin/insights" });
  }

  return (
    <div className="mb-10 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-navy">Command Center</h2>
        <p className="mt-1 text-xs text-muted">DeployFleet&apos;s own pipeline — pace, attention, and what to do next.</p>
      </div>

      {loadError && <p className="text-sm text-danger">Couldn&apos;t load Command Center data ({loadError}).</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card-surface p-4">
          <p className="text-2xl font-bold text-navy">
            {state ? `${state.todayAttempts}/${state.targetAttemptsPerDay}` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">Attempts today</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-2xl font-bold text-navy">{dueTodayCount ?? "—"}</p>
          <p className="mt-1 text-xs text-muted">Prospects needing attention</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-2xl font-bold text-navy">{state?.overdueProspectCount ?? "—"}</p>
          <p className="mt-1 text-xs text-muted">Overdue next actions</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-2xl font-bold text-navy">{staleEmployees ? staleEmployees.length : "—"}</p>
          <p className="mt-1 text-xs text-muted">AI workforce awaiting report</p>
        </div>
      </div>

      {state?.biggestBottleneck && (
        <div className="rounded-df-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-navy">{state.biggestBottleneck}</div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Top actions</p>
        <div className="mt-2 space-y-1.5">
          {topActions.slice(0, 3).map((a) => (
            <Link key={a.href + a.label} href={a.href} className="card-surface block p-3 text-sm text-navy hover:border-teal/50">
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">What should I do right now?</p>
        <div className="mt-2">
          <ChatInput
            value={prompt}
            onChange={setPrompt}
            placeholder="Ask the Orchestrator — e.g. “what's my biggest risk this week?”"
            disabled={asking}
            minRows={1}
            maxRows={8}
            onSubmit={ask}
            submitDisabled={asking || !prompt.trim()}
          />
        </div>

        {asking && <p className="mt-2 text-xs text-muted">Thinking…</p>}

        {response && (
          <div className="mt-3 card-surface p-4">
            {!response.ok ? (
              <p className="text-sm text-muted">
                {response.reason === "no_providers_configured"
                  ? "No AI provider is configured — set DEEPSEEK_API_KEY or GEMINI_API_KEY."
                  : response.reason === "ai_disabled"
                    ? "AI features are currently disabled."
                    : "The Orchestrator is temporarily unavailable — try again shortly."}
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-body">{response.text}</p>
                {response.toolLog.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-border pt-2">
                    {response.toolLog.map((t, i) => (
                      <p key={i} className="text-[11px] text-muted">
                        <span className="font-medium text-navy">{t.tool}</span> — {t.resultSummary}
                      </p>
                    ))}
                  </div>
                )}
                {response.proposals.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Proposed actions</p>
                    {response.proposals.map((p, i) => {
                      const highStakes = isHighStakesStageChange(p);
                      const approved = approvedIndexes.has(i);
                      return (
                        <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-df-md border border-border bg-canvas p-2.5 text-xs">
                          <span className="text-body">{p.description}</span>
                          {approved ? (
                            <span className="font-medium text-teal">Approved</span>
                          ) : highStakes ? (
                            <span className="text-muted">Stage change past Qualified — review directly on the prospect page.</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => approve(i)}
                              disabled={approving === i}
                              className="btn-secondary text-xs disabled:opacity-50"
                            >
                              {approving === i ? "Applying…" : "Approve"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
