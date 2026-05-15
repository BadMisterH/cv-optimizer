"use client";

import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, KeyboardSensor } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { CVSection } from "@/app/types";
import type { EditorAction } from "@/app/lib/editorState";
import { EditableText } from "./EditableText";
import { ItemBlock } from "./ItemBlock";

type Props = {
  section: CVSection;
  sectionIndex: number;
  dispatch: React.Dispatch<EditorAction>;
};

export function SectionBlock({ section, sectionIndex, dispatch }: Props) {
  const sortable = useSortable({ id: `section-${sectionIndex}` });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleItemDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromId = String(active.id);
    const toId = String(over.id);
    const from = Number(fromId.split("-")[2]);
    const to = Number(toId.split("-")[2]);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      dispatch({ type: "MOVE_ITEM", sectionIndex, from, to });
    }
  }

  return (
    <div ref={sortable.setNodeRef} style={style} className="group/section relative">
      {/* Section controls */}
      <div className="absolute -left-12 top-0 hidden flex-col gap-1 group-hover/section:flex">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label="Déplacer cette section"
          className="inline-flex h-6 w-6 cursor-grab items-center justify-center border border-rule bg-paper text-ink-muted active:cursor-grabbing hover:text-ink"
        >
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <circle cx="4" cy="3" r="1" /><circle cx="8" cy="3" r="1" />
            <circle cx="4" cy="6" r="1" /><circle cx="8" cy="6" r="1" />
            <circle cx="4" cy="9" r="1" /><circle cx="8" cy="9" r="1" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Supprimer la section "${section.title}" ?`)) {
              dispatch({ type: "DELETE_SECTION", sectionIndex });
            }
          }}
          aria-label="Supprimer cette section"
          className="inline-flex h-6 w-6 items-center justify-center border border-rule bg-paper text-ink-muted transition hover:border-danger hover:text-danger"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M3 3L9 9M9 3L3 9" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mb-3 flex items-baseline gap-3 border-b border-rule pb-1">
        <span className="font-mono text-[12px] font-medium uppercase tracking-[0.22em] text-accent">
          {String(sectionIndex + 1).padStart(2, "0")}
        </span>
        <h4 className="font-display text-sm font-medium uppercase tracking-[0.16em] text-ink">
          <EditableText
            value={section.title}
            onChange={(value) => dispatch({ type: "EDIT_SECTION_TITLE", sectionIndex, value })}
            placeholder="Titre de section"
            ariaLabel="Titre de section"
          />
        </h4>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
        <SortableContext
          items={section.items.map((_, ii) => `item-${sectionIndex}-${ii}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {section.items.map((item, ii) => (
              <ItemBlock
                key={`item-${sectionIndex}-${ii}`}
                item={item}
                sectionIndex={sectionIndex}
                itemIndex={ii}
                dispatch={dispatch}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => dispatch({ type: "ADD_ITEM", sectionIndex })}
        className="mt-4 inline-flex items-center gap-2 border border-dashed border-rule px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted transition hover:border-accent hover:text-accent"
      >
        + ajouter un item
      </button>
    </div>
  );
}
