"use client";

import { useEffect, useState } from "react";
import type { ProspectContact } from "@/lib/crmTypes";

/**
 * docs/whatsapp-intelligence-architecture.md §5.2/§14 WA-1 — Winston's
 * own "Reception / Operations Manager / Unknown, each with their own
 * number" example. A prospect's own contactPhone/contactWhatsapp fields
 * stay the primary number; this is the growing list of additional
 * numbers discovered along the way.
 */
export default function ProspectContacts({ prospectId }: { prospectId: string }) {
  const [contacts, setContacts] = useState<ProspectContact[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/admin/crm/prospects/${prospectId}/contacts`)
      .then((res) => res.json())
      .then((data) => data.ok && setContacts(data.contacts));
  }

  useEffect(load, [prospectId]);

  async function addContact() {
    if (!phone.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/crm/prospects/${prospectId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, role: role.trim() || null, phone: phone.trim() }),
      });
      setName("");
      setRole("");
      setPhone("");
      setAdding(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Additional contacts</p>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs text-teal hover:underline">
            + Add contact
          </button>
        )}
      </div>

      {contacts === null ? (
        <p className="mt-2 text-xs text-muted">Loading…</p>
      ) : contacts.length === 0 && !adding ? (
        <p className="mt-2 text-xs text-muted">No other contacts on file yet — e.g. a reception line or an operations manager&apos;s own number.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {contacts?.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-df-md border border-border bg-canvas p-2 text-xs">
              <span className="text-navy">
                {c.name ?? "Unnamed"}
                {c.role ? ` (${c.role})` : ""} — {c.phone}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 font-medium ${
                  c.whatsappStatus === "verified"
                    ? "border-teal/40 bg-teal/10 text-teal"
                    : c.whatsappStatus === "unavailable"
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-border text-muted"
                }`}
              >
                {c.whatsappStatus === "verified" ? "WhatsApp verified" : c.whatsappStatus === "unavailable" ? "Not on WhatsApp" : "Unverified"}
              </span>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-2 space-y-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role (optional) — e.g. Operations Manager"
            className="w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
          />
          <div className="flex gap-2">
            <button type="button" onClick={addContact} disabled={saving || !phone.trim()} className="btn-primary text-xs disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
