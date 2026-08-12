"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ChatInput from "./ChatInput";
import WhatsAppConnectPanel from "./WhatsAppConnectPanel";
import { CONVERSATION_STATE_LABEL, type ConversationState, type WhatsAppMessage, type WhatsAppMessageSenderType } from "@/lib/crmTypes";

/**
 * DeployFleet's own WhatsApp Inbox — the layout pattern (conversation
 * list / message thread / composer, WhatsApp-style bubble colors, day
 * dividers, auto-scroll) is adapted from Zuri
 * (`creativesites/Personal-Assistant`)'s own `apps/web/.../inbox/`, per
 * explicit user direction to "take it as is and remove some zuri
 * features." Everything Zuri-specific and not relevant to a B2B sales
 * CRM is dropped: WhatsApp Status/stories, voice notes, group chat,
 * document/quote-suggestion cards, media, the AI relationship-
 * intelligence side panel, and real-time Socket.IO presence — this
 * polls instead, the same pattern every other live-ish view in this
 * admin dashboard already uses.
 *
 * **This inbox only ever shows conversations with prospects already in
 * DeployFleet's system, structurally, not by filtering** — per the
 * user's own framing. `WhatsAppConversation` rows are only ever created
 * by `getOrCreateConversation()` (crm.ts), called from the outbound
 * send route or the inbound webhook after `findProspectByPhone()`
 * matches a real prospect; an unrecognized number never gets this far
 * (see docs/whatsapp-intelligence-architecture.md §7). There is no
 * unknown-number chat to hide here.
 */

interface ConversationListItem {
  id: string;
  prospectId: string;
  prospectName: string;
  whatsappJid: string;
  state: ConversationState;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  requiresResponse: boolean;
  responseUrgency: "low" | "medium" | "high" | "urgent" | null;
}

type FilterId = "all" | "unread" | "needs_response";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "needs_response", label: "Needs response" },
];

const LIST_POLL_MS = 20_000;
const THREAD_POLL_MS = 10_000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Ported from Zuri's own `_lib/utils.ts` formatTime(). */
function formatTime(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffDays = Math.floor(diffMin / 1440);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function dayKey(ts: string): string {
  return new Date(ts).toDateString();
}

/** Ported from Zuri's own message-thread.tsx formatDateSeparator(). */
function formatDateSeparator(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

const URGENCY_DOT: Record<string, string> = {
  urgent: "bg-danger",
  high: "bg-amber-500",
  medium: "bg-teal",
  low: "bg-border",
};

function ConversationRow({ conv, active, onClick }: { conv: ConversationListItem; active: boolean; onClick: () => void }) {
  const unread = conv.unreadCount > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors ${
        active ? "border-teal bg-teal/10" : "border-transparent hover:bg-canvas"
      }`}
    >
      <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-semibold text-navy">
        {initials(conv.prospectName)}
        {unread && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-card bg-teal px-0.5 text-[9px] font-bold text-white">
            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-1">
          <span className={`truncate text-sm ${unread ? "font-semibold text-navy" : "font-medium text-body"}`}>{conv.prospectName}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted">{formatTime(conv.lastMessageAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {conv.requiresResponse && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${URGENCY_DOT[conv.responseUrgency ?? "low"]}`} aria-hidden="true" />}
          <p className={`truncate text-xs ${unread ? "text-body" : "text-muted"}`}>{conv.lastMessagePreview || "No messages yet"}</p>
        </div>
      </div>
    </button>
  );
}

function StatusTick({ senderType }: { senderType: WhatsAppMessageSenderType }) {
  // Honest, not a fake WhatsApp double/blue-tick — this build has no
  // delivery/read receipt event wired up from the gateway (out of scope,
  // see docs/whatsapp-intelligence-architecture.md §15). A single check
  // only ever means "this message reached the gateway successfully,"
  // which is the one thing WhatsAppSend.status="sent" actually confirms.
  if (senderType !== "winston") return null;
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-label="Sent" className="text-muted">
      <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MessageBubble({ msg }: { msg: WhatsAppMessage }) {
  const isWinston = msg.senderType === "winston";
  return (
    <div className={`flex px-1 ${isWinston ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl border px-3.5 py-2 text-sm leading-relaxed shadow-sm sm:max-w-md ${
          isWinston ? "rounded-tr-sm border-teal/20 bg-gradient-to-br from-teal/20 to-teal/10 text-navy" : "rounded-tl-sm border-border bg-card text-navy"
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.body}</p>
        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10px] tabular-nums text-muted">
            {new Date(msg.whatsappTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <StatusTick senderType={msg.senderType} />
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppInboxTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [conversations, setConversations] = useState<ConversationListItem[] | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prospectName, setProspectName] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<ConversationState | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(() => {
    fetch("/api/admin/crm/whatsapp/conversations")
      .then((res) => res.json())
      .then((data) => data.ok && setConversations(data.conversations));
  }, []);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    loadConversations();
    const interval = setInterval(loadConversations, LIST_POLL_MS);
    return () => clearInterval(interval);
  }, [firebaseAdminConfigured, loadConversations]);

  const loadThread = useCallback((id: string) => {
    fetch(`/api/admin/crm/whatsapp/conversations/${id}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) return;
        setMessages(data.messages);
        setProspectName(data.prospect?.name ?? null);
        setConversationState(data.conversation?.state ?? null);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadThread(selectedId);
    fetch(`/api/admin/crm/whatsapp/conversations/${selectedId}/read`, { method: "POST" }).then(loadConversations);
    const interval = setInterval(() => loadThread(selectedId), THREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [selectedId, loadThread, loadConversations]);

  useEffect(() => {
    if (messages && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send() {
    const selected = conversations?.find((c) => c.id === selectedId);
    if (!selected || !draft.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/admin/crm/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: selected.prospectId, message: draft.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setDraft("");
        await Promise.all([loadThread(selected.id), loadConversations()]);
      } else {
        setSendError(
          data.reason === "cooldown_active"
            ? `Wait ${data.hoursRemaining}h before messaging this prospect again.`
            : data.reason === "daily_cap_reached"
              ? "Today's 20-message cap is reached."
              : "Couldn't send that message."
        );
      }
    } catch {
      setSendError("Network error — nothing was sent.");
    } finally {
      setSending(false);
    }
  }

  if (!firebaseAdminConfigured) {
    return <div className="card-surface p-6 text-sm text-muted">Firebase Admin isn&apos;t configured — the WhatsApp Inbox has nothing to show.</div>;
  }

  const filtered = (conversations ?? []).filter((c) => {
    if (filter === "unread") return c.unreadCount > 0;
    if (filter === "needs_response") return c.requiresResponse;
    return true;
  });

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <WhatsAppConnectPanel onConnected={loadConversations} />
      <div className="flex h-[calc(100vh-280px)] min-h-[420px] overflow-hidden rounded-df-lg border border-border bg-card">
      {/* Conversation list */}
      <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-border md:w-72`}>
        <div className="flex gap-1.5 border-b border-border p-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f.id ? "bg-teal text-white" : "bg-canvas text-muted hover:text-navy"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations === null ? (
            <p className="p-4 text-xs text-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-xs text-muted">
              {conversations.length === 0
                ? "No WhatsApp conversations yet — they appear here once a verified prospect messages in, or you send the first message from their page."
                : "Nothing matches this filter."}
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {filtered.map((c) => (
                <ConversationRow key={c.id} conv={c} active={c.id === selectedId} onClick={() => setSelectedId(c.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={`${selectedId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">Select a conversation to view it.</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <button type="button" onClick={() => setSelectedId(null)} className="text-muted hover:text-navy md:hidden" aria-label="Back">
                  ←
                </button>
                <div>
                  <Link href={`/admin/prospects/${selected.prospectId}`} className="truncate text-sm font-semibold text-navy hover:text-teal">
                    {prospectName ?? selected.prospectName}
                  </Link>
                  {conversationState && <p className="text-[11px] text-muted">{CONVERSATION_STATE_LABEL[conversationState]}</p>}
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-canvas px-2 py-4">
              {messages === null ? (
                <p className="p-4 text-center text-xs text-muted">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted">No messages yet.</p>
              ) : (
                messages.map((msg, idx) => {
                  const prev = messages[idx - 1];
                  const showDate = !prev || dayKey(prev.whatsappTimestamp) !== dayKey(msg.whatsappTimestamp);
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="my-2 flex justify-center">
                          <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted shadow-sm ring-1 ring-border">
                            {formatDateSeparator(msg.whatsappTimestamp)}
                          </span>
                        </div>
                      )}
                      <MessageBubble msg={msg} />
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-border p-2.5">
              <ChatInput
                value={draft}
                onChange={setDraft}
                placeholder="Type a message…"
                minRows={1}
                maxRows={6}
                onSubmit={send}
                submitDisabled={sending || !draft.trim()}
              />
              {sendError && <p className="mt-1.5 text-xs text-danger">{sendError}</p>}
            </div>
          </>
        )}
      </div>
      </div>
    </>
  );
}
