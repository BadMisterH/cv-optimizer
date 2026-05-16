"use client";

import { useEffect, useReducer, useRef } from "react";
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, KeyboardSensor } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { OptimizedCV } from "@/app/types";
import {
  ACCENT_HEX,
  type EditorState,
  editorReducer,
  readDraft,
  saveDraft,
  clearDraft,
} from "@/app/lib/editorState";
import { EditableText } from "./EditableText";
import { EditorHelpHint } from "./EditorHelpHint";
import { EditorToolbar } from "./EditorToolbar";
import { SectionBlock } from "./SectionBlock";

type Props = {
  cv: OptimizedCV;
  photo: string | null;
  onChange?: (state: EditorState) => void;
};

export function CVEditor({ cv, photo, onChange }: Props) {
  // Initialise depuis le draft localStorage s'il existe pour ce CV, sinon depuis le CV fraîchement généré
  const [state, dispatch] = useReducer(editorReducer, undefined, () => {
    const draft = readDraft();
    if (draft && draft.cv.fullName === cv.fullName) return draft;
    return { cv, accent: "blue" as const, template: "classic" as const };
  });

  // Re-init si on change de CV (nouvelle génération)
  const lastFullName = useRef(cv.fullName);
  useEffect(() => {
    if (cv.fullName !== lastFullName.current) {
      lastFullName.current = cv.fullName;
      dispatch({ type: "RESET", cv });
    }
  }, [cv]);

  // Persiste à chaque changement
  useEffect(() => {
    saveDraft(state);
    onChange?.(state);
  }, [state, onChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleSectionDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = Number(String(active.id).split("-")[1]);
    const to = Number(String(over.id).split("-")[1]);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      dispatch({ type: "MOVE_SECTION", from, to });
    }
  }

  function handleReset() {
    clearDraft();
    dispatch({ type: "RESET", cv });
  }

  const contactValues = [
    state.cv.contact.email,
    state.cv.contact.phone,
    state.cv.contact.location,
    state.cv.contact.linkedin,
    state.cv.contact.github,
    state.cv.contact.portfolio,
  ].filter((v) => v && v.trim().length > 0);

  return (
    <article
      className="space-y-8"
      style={{ ["--editor-accent" as string]: ACCENT_HEX[state.accent] }}
    >
      <EditorToolbar
        accent={state.accent}
        template={state.template}
        dispatch={dispatch}
        onReset={handleReset}
      />

      <EditorHelpHint />

      {/* Header CV */}
      <header className="flex items-start gap-5 border-b border-ink pb-5">
        <div className="flex-1 min-w-0">
          <span className="font-mono text-[12px] uppercase tracking-[0.24em] text-ink-muted">
            Curriculum Vitæ
          </span>
          <h3 className="mt-2 font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink">
            <EditableText
              value={state.cv.title}
              onChange={(value) => dispatch({ type: "EDIT_TITLE", value })}
              placeholder="Titre du poste visé"
              ariaLabel="Titre"
            />
          </h3>
          <p className="mt-2 text-sm font-medium text-ink-soft">
            <EditableText
              value={state.cv.fullName}
              onChange={(value) => dispatch({ type: "EDIT_FULLNAME", value })}
              placeholder="Ton nom complet"
              ariaLabel="Nom complet"
            />
          </p>
          {contactValues.length > 0 && (
            <p className="mt-4 font-mono text-[12px] tracking-[0.04em] text-ink-muted">
              {contactValues.join("  ·  ")}
            </p>
          )}
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-24 w-20 shrink-0 rounded-sm object-cover" />
        )}
      </header>

      {/* Accroche */}
      <div>
        <div className="mb-3 flex items-baseline gap-3 border-b border-rule pb-1">
          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.22em] text-accent">00</span>
          <h4 className="font-display text-sm font-medium uppercase tracking-[0.16em] text-ink">À propos</h4>
        </div>
        <p className="text-[15px] leading-relaxed text-ink-soft">
          <EditableText
            value={state.cv.accroche}
            onChange={(value) => dispatch({ type: "EDIT_ACCROCHE", value })}
            placeholder="Une accroche en 2-3 phrases qui pose ton profil et ta motivation"
            multiline
            ariaLabel="Accroche"
          />
        </p>
      </div>

      {/* Sections draggables */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext
          items={state.cv.sections.map((_, i) => `section-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-8">
            {state.cv.sections.map((section, si) => (
              <SectionBlock
                key={`section-${si}`}
                section={section}
                sectionIndex={si}
                dispatch={dispatch}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </article>
  );
}
