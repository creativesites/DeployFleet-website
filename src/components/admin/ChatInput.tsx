"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";

/**
 * A Gemini-composer-style text input: auto-grows with content up to
 * maxRows (then scrolls internally), and settles into a compact
 * "minimized" pill when idle/blurred with nothing typed, expanding back
 * to the full multi-line composer on focus — which on a touchscreen is
 * the same event as a tap, so "expand on touch" comes for free from the
 * native focus event, no extra touch handling needed. Used anywhere in
 * `/admin` that takes freeform text: the AI Inbox paste box, the
 * Command Center's "what should I do right now?" prompt.
 */

const LINE_HEIGHT_PX = 20;
const VERTICAL_PADDING_PX = 20;

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
  maxRows?: number;
  autoFocus?: boolean;
  /** Enter (without Shift) submits; a send button also renders when this is set. */
  onSubmit?: () => void;
  submitDisabled?: boolean;
  submitLabel?: string;
}

export default function ChatInput({
  value,
  onChange,
  placeholder,
  disabled,
  minRows = 1,
  maxRows = 10,
  autoFocus,
  onSubmit,
  submitDisabled,
  submitLabel,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = maxRows * LINE_HEIGHT_PX + VERTICAL_PADDING_PX;
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxRows]);

  const collapsed = !focused && !value.trim();

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      if (!submitDisabled) onSubmit();
    }
  }

  return (
    <motion.div
      layout
      animate={{ borderRadius: collapsed ? 999 : 18 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={`flex items-end gap-2 border bg-canvas px-3.5 py-2.5 transition-colors ${
        focused ? "border-teal shadow-[0_0_0_3px_rgba(11,147,211,0.12)]" : "border-border"
      }`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={minRows}
        autoFocus={autoFocus}
        className="min-w-0 flex-1 resize-none bg-transparent text-sm leading-5 text-navy outline-none placeholder:text-muted disabled:opacity-50"
      />
      {onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          aria-label={submitLabel ?? "Send"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-white transition-transform disabled:opacity-30 disabled:grayscale enabled:active:scale-90"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </motion.div>
  );
}
