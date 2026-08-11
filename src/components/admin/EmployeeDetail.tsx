"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { TASK_STATUS_LABEL, INBOX_SOURCE_TYPE_LABEL, type AiEmployee, type InboxEntry, type Task, type TaskStatus } from "@/lib/crmTypes";
import InboxPasteBox from "./InboxPasteBox";

/** Phase 1 §7.3 — one AI employee's dedicated page: Mission, Objectives/tasks, the paste-box conversation feed, a deterministic Performance summary, and standing instructions/notes. */
export default function EmployeeDetail({ id }: { id: string }) {
  const [employee, setEmployee] = useState<AiEmployee | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<InboxEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingMission, setEditingMission] = useState(false);
  const [missionInput, setMissionInput] = useState("");
  const [instructionsInput, setInstructionsInput] = useState("");
  const [saving, setSaving] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  function load() {
    fetch(`/api/admin/crm/employees/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setEmployee(data.employee);
          setTasks(data.tasks);
          setMissionInput(data.employee.mission);
          setInstructionsInput(data.employee.instructions);
        } else {
          setError(data.reason ?? "unknown_error");
        }
      })
      .catch(() => setError("network_error"));

    fetch(`/api/admin/crm/inbox?relatedEmployeeId=${id}`)
      .then((res) => res.json())
      .then((data) => data.ok && setEntries(data.entries));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveMission() {
    setSaving(true);
    try {
      await fetch(`/api/admin/crm/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: missionInput, instructions: instructionsInput }),
      });
      setEditingMission(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!employee) return;
    await fetch(`/api/admin/crm/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: employee.status === "active" ? "paused" : "active" }),
    });
    load();
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      await fetch("/api/admin/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          dueDate: newTaskDue || null,
          relatedEmployeeId: id,
          createdBy: "human",
        }),
      });
      setNewTaskTitle("");
      setNewTaskDue("");
      load();
    } finally {
      setAddingTask(false);
    }
  }

  async function setTaskStatus(taskId: string, status: TaskStatus) {
    await fetch(`/api/admin/crm/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load this employee ({error}).</p>;
  if (!employee) return <p className="text-sm text-muted">Loading…</p>;

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const completionRate = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : null;

  return (
    <div>
      <Link href="/admin/team" className="text-xs text-teal hover:underline">
        ← Team
      </Link>

      <div className="card-surface mt-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-navy">{employee.name}</h1>
            <p className="text-sm text-muted">{employee.role}</p>
          </div>
          <button
            type="button"
            onClick={toggleStatus}
            className={`rounded-full px-3 py-1 text-xs font-medium ${employee.status === "active" ? "bg-teal/10 text-teal" : "bg-canvas text-muted"}`}
          >
            {employee.status === "active" ? "Active — tap to pause" : "Paused — tap to activate"}
          </button>
        </div>

        {!editingMission ? (
          <div className="mt-3">
            <p className="text-sm text-body">{employee.mission}</p>
            {employee.instructions && <p className="mt-1 text-xs text-muted">Standing instructions: {employee.instructions}</p>}
            <button type="button" onClick={() => setEditingMission(true)} className="mt-2 text-xs text-teal hover:underline">
              Edit mission / instructions
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div>
              <label htmlFor="mission" className="text-xs font-medium text-navy">
                Mission
              </label>
              <textarea
                id="mission"
                value={missionInput}
                onChange={(e) => setMissionInput(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label htmlFor="instructions" className="text-xs font-medium text-navy">
                Standing instructions / notes
              </label>
              <textarea
                id="instructions"
                value={instructionsInput}
                onChange={(e) => setInstructionsInput(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveMission} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditingMission(false)} className="btn-secondary text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}

        {completionRate !== null && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
            Performance: {doneCount}/{tasks.length} tasks completed ({completionRate}%)
          </p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Objectives / tasks</p>
        <form onSubmit={addTask} className="mt-2 flex flex-wrap gap-2">
          <input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="New task title"
            className="min-w-[200px] flex-1 rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
          />
          <input
            type="date"
            value={newTaskDue}
            onChange={(e) => setNewTaskDue(e.target.value)}
            className="rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
          />
          <button type="submit" disabled={addingTask || !newTaskTitle.trim()} className="btn-secondary text-sm disabled:opacity-50">
            Add
          </button>
        </form>

        <div className="mt-3 space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted">No tasks yet.</p>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="card-surface flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className={t.status === "done" || t.status === "cancelled" ? "text-muted line-through" : "text-navy"}>{t.title}</p>
                  {t.dueDate && <p className="text-xs text-muted">Due {t.dueDate}</p>}
                </div>
                <select
                  value={t.status}
                  onChange={(e) => setTaskStatus(t.id, e.target.value as TaskStatus)}
                  className="rounded-df-md border border-border bg-canvas px-2 py-1 text-xs text-navy outline-none focus:border-teal"
                >
                  {Object.entries(TASK_STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paste a conversation / report</p>
        <div className="mt-2">
          <InboxPasteBox relatedEmployeeId={id} onApplied={load} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Past entries</p>
        {!entries ? (
          <p className="mt-2 text-sm text-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing pasted yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="card-surface p-3 text-xs">
                <p className="text-muted">
                  {new Date(e.createdAt).toLocaleString()} · {INBOX_SOURCE_TYPE_LABEL[e.sourceType]}
                </p>
                <p className="mt-1 text-body">{e.rawText.slice(0, 300)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
