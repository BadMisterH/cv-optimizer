"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  ariaLabel?: string;
};

/**
 * Texte éditable click-to-edit.
 * - Affiche le texte (ou le placeholder en italique grisé si vide)
 * - Cliquer le rend éditable (contentEditable)
 * - Sauvegarde au blur ou à Enter (sauf si multiline)
 * - Échap annule
 */
export function EditableText({
  value,
  onChange,
  placeholder = "Cliquer pour éditer",
  multiline = false,
  className = "",
  ariaLabel,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    if (draft.trim() !== value) onChange(draft.trim());
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      ref.current?.blur();
    } else if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      commit();
      ref.current?.blur();
    }
  }

  const isEmpty = !value || value.trim() === "";

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={ariaLabel ?? placeholder}
      aria-multiline={multiline}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={handleKey}
      onInput={(e) => setDraft((e.target as HTMLSpanElement).innerText)}
      className={`-mx-1 inline-block min-w-[1ch] rounded-sm px-1 outline-none transition ${
        editing
          ? "bg-accent-soft ring-1 ring-accent"
          : "hover:bg-paper-deep focus:bg-accent-soft focus:ring-1 focus:ring-accent"
      } ${isEmpty && !editing ? "italic text-ink-faint" : ""} ${className}`}
    >
      {isEmpty && !editing ? placeholder : value}
    </span>
  );
}
