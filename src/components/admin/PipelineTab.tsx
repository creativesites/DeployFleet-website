"use client";

import { useEffect, useState } from "react";
import { PIPELINE_STAGE_LABEL, PIPELINE_STAGES, type PipelineStage, type Prospect } from "@/lib/crmTypes";

/**
 * Phase 0 §6.1's Pipeline/Kanban view — a horizontal-scroll stage board.
 * Tap-to-move, not drag-and-drop: this project's own mobile-first
 * precedent (see the DeployFleet Odoo sibling's Dispatch Board reasoning)
 * applies just as much here, since Winston works this from a phone as
 * often as a desktop. Each card has a "Move to..." select instead of a
 * drag handle.
 */
export default function PipelineTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    fetch("/api/admin/crm/prospects")
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
  }, [firebaseAdminConfigured]);

  async function moveStage(prospectId: string, stage: PipelineStage) {
    setMovingId(prospectId);
    const res = await fetch(`/api/admin/crm/prospects/${prospectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    const data = await res.json();
    if (data.ok) {
      setProspects((prev) => (prev ? prev.map((p) => (p.id === prospectId ? { ...p, stage } : p)) : prev));
    }
    setMovingId(null);
  }

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see the pipeline. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load the pipeline ({error}).</p>;

  if (!prospects) return <p className="mt-6 text-sm text-muted">Loading…</p>;

  const byStage = new Map<PipelineStage, Prospect[]>(PIPELINE_STAGES.map((s) => [s, []]));
  for (const p of prospects) {
    byStage.get(p.stage)?.push(p);
  }

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {PIPELINE_STAGES.map((stage) => {
        const stageProspects = byStage.get(stage) ?? [];
        return (
          <div key={stage} className="flex w-64 shrink-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy">{PIPELINE_STAGE_LABEL[stage]}</p>
              <span className="text-xs text-muted">{stageProspects.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {stageProspects.length === 0 ? (
                <div className="rounded-df-md border border-dashed border-border p-3 text-center text-xs text-muted">Empty</div>
              ) : (
                stageProspects.map((p) => (
                  <div key={p.id} className="card-surface p-3">
                    <p className="text-sm font-semibold text-navy">{p.name}</p>
                    <p className="text-xs text-body">{p.contactName ?? "No contact name"}</p>
                    {p.nextActionDate && <p className="mt-1 text-[11px] text-muted">Next: {p.nextActionDate}</p>}
                    {p.priorityScore !== null && (
                      <span className="mt-1 inline-block rounded-full border border-border bg-canvas px-2 py-0.5 text-[10px] font-medium text-navy">
                        Priority {p.priorityScore}
                      </span>
                    )}
                    <select
                      value={p.stage}
                      disabled={movingId === p.id}
                      onChange={(e) => moveStage(p.id, Number(e.target.value) as PipelineStage)}
                      className="mt-2 w-full rounded-df-md border border-border bg-canvas px-2 py-1.5 text-xs text-navy outline-none focus:border-teal disabled:opacity-50"
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s} value={s}>
                          Move to: {PIPELINE_STAGE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
