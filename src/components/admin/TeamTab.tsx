"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TeamBriefingBars from "./TeamBriefingBars";
import type { AiEmployee, Task } from "@/lib/crmTypes";

/** Phase 1 §7.3 — the AI Workforce list. Cards link to each employee's dedicated page. */
export default function TeamTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [employees, setEmployees] = useState<AiEmployee[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  function reload() {
    Promise.all([fetch("/api/admin/crm/employees").then((r) => r.json()), fetch("/api/admin/crm/tasks?status=open").then((r) => r.json())])
      .then(([employeesData, tasksData]) => {
        if (employeesData.ok) setEmployees(employeesData.employees);
        else setError(employeesData.reason ?? "unknown_error");
        if (tasksData.ok) setTasks(tasksData.tasks);
      })
      .catch(() => setError("network_error"));
  }

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    reload();
  }, [firebaseAdminConfigured]);

  async function seed() {
    setSeeding(true);
    try {
      await fetch("/api/admin/crm/employees/seed", { method: "POST" });
      reload();
    } finally {
      setSeeding(false);
    }
  }

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see the AI workforce. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load the team ({error}).</p>;
  if (!employees) return <p className="text-sm text-muted">Loading…</p>;

  if (employees.length === 0) {
    return (
      <div>
        <p className="text-sm text-muted">No AI employees yet.</p>
        <button type="button" onClick={seed} disabled={seeding} className="btn-primary mt-3 text-sm disabled:opacity-50">
          {seeding ? "Seeding…" : "Seed starter AI workforce (5 personas)"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TeamBriefingBars variant="full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {employees.map((emp) => {
        const openTasks = tasks.filter((t) => t.relatedEmployeeId === emp.id);
        return (
          <Link key={emp.id} href={`/admin/team/${emp.id}`} className="card-surface block p-4 hover:border-teal/50">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-navy">{emp.name}</p>
                <p className="text-xs text-muted">{emp.role}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  emp.status === "active" ? "bg-teal/10 text-teal" : "bg-canvas text-muted"
                }`}
              >
                {emp.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-body line-clamp-2">{emp.mission}</p>
            <p className="mt-2 text-xs text-muted">{openTasks.length} open task{openTasks.length === 1 ? "" : "s"}</p>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
