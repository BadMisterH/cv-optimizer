"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CVItem } from "@/app/types";
import type { EditorAction } from "@/app/lib/editorState";
import { EditableText } from "./EditableText";

type Props = {
  item: CVItem;
  sectionIndex: number;
  itemIndex: number;
  dispatch: React.Dispatch<EditorAction>;
};

export function ItemBlock({ item, sectionIndex, itemIndex, dispatch }: Props) {
  const sortable = useSortable({ id: `item-${sectionIndex}-${itemIndex}` });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className="group/item relative border-l-2 border-transparent pl-3 transition hover:border-rule"
    >
      {/* Drag handle + delete */}
      <div className="absolute -left-7 top-0 hidden flex-col gap-1 group-hover/item:flex">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label="Déplacer cet item"
          className="inline-flex h-5 w-5 cursor-grab items-center justify-center border border-rule bg-paper text-ink-muted active:cursor-grabbing hover:text-ink"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden>
            <circle cx="4" cy="3" r="1" /><circle cx="8" cy="3" r="1" />
            <circle cx="4" cy="6" r="1" /><circle cx="8" cy="6" r="1" />
            <circle cx="4" cy="9" r="1" /><circle cx="8" cy="9" r="1" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "DELETE_ITEM", sectionIndex, itemIndex })}
          aria-label="Supprimer cet item"
          className="inline-flex h-5 w-5 items-center justify-center border border-rule bg-paper text-ink-muted transition hover:border-danger hover:text-danger"
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M3 3L9 9M9 3L3 9" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {item.heading !== undefined && (
        <p className="text-[15px] font-medium text-ink">
          <EditableText
            value={item.heading}
            onChange={(value) =>
              dispatch({ type: "EDIT_ITEM_FIELD", sectionIndex, itemIndex, field: "heading", value })
            }
            placeholder="Intitulé / poste"
            ariaLabel="Intitulé"
          />
          {item.company !== undefined && (
            <>
              {item.company || true ? (
                <span className="font-semibold text-accent">
                  {" · "}
                  <EditableText
                    value={item.company ?? ""}
                    onChange={(value) =>
                      dispatch({ type: "EDIT_ITEM_FIELD", sectionIndex, itemIndex, field: "company", value })
                    }
                    placeholder="Entreprise"
                    ariaLabel="Entreprise"
                    className="text-accent"
                  />
                </span>
              ) : null}
            </>
          )}
        </p>
      )}

      <p className="mt-0.5 font-mono text-[12px] tracking-[0.04em] text-ink-muted">
        <EditableText
          value={item.subheading}
          onChange={(value) =>
            dispatch({ type: "EDIT_ITEM_FIELD", sectionIndex, itemIndex, field: "subheading", value })
          }
          placeholder="Dates · lieu · secteur"
          ariaLabel="Sous-titre"
        />
      </p>

      {/* Bullets */}
      {item.bullets.length > 0 && (
        <ul className="mt-2 space-y-1">
          {item.bullets.map((b, bi) => (
            <li key={bi} className="group/bullet flex items-start gap-3 text-[14px] leading-relaxed text-ink-soft">
              <span aria-hidden className="mt-2 inline-block h-px w-3 shrink-0 bg-ink" />
              <span className="flex-1">
                <EditableText
                  value={b}
                  onChange={(value) =>
                    dispatch({ type: "EDIT_BULLET", sectionIndex, itemIndex, bulletIndex: bi, value })
                  }
                  placeholder="Décris une réalisation concrète"
                  multiline
                  ariaLabel={`Bullet ${bi + 1}`}
                />
              </span>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "DELETE_BULLET", sectionIndex, itemIndex, bulletIndex: bi })
                }
                aria-label="Supprimer cette ligne"
                className="opacity-0 transition group-hover/bullet:opacity-100"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3 text-ink-faint hover:text-danger" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M3 3L9 9M9 3L3 9" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => dispatch({ type: "ADD_BULLET", sectionIndex, itemIndex })}
        className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint transition hover:text-accent"
      >
        + ajouter une ligne
      </button>

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {item.tags.map((t, ti) => (
            <span
              key={ti}
              className="group/tag relative inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] text-accent"
            >
              <EditableText
                value={t}
                onChange={(value) =>
                  dispatch({ type: "EDIT_TAG", sectionIndex, itemIndex, tagIndex: ti, value })
                }
                placeholder="tag"
                className="text-accent"
                ariaLabel={`Tag ${ti + 1}`}
              />
              <button
                type="button"
                onClick={() => dispatch({ type: "DELETE_TAG", sectionIndex, itemIndex, tagIndex: ti })}
                aria-label="Supprimer ce tag"
                className="opacity-0 transition group-hover/tag:opacity-100"
              >
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M3 3L9 9M9 3L3 9" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              const v = window.prompt("Nouveau tag");
              if (v && v.trim()) dispatch({ type: "ADD_TAG", sectionIndex, itemIndex, value: v.trim() });
            }}
            className="rounded-full border border-dashed border-rule px-2.5 py-0.5 text-[12px] text-ink-muted hover:border-accent hover:text-accent"
          >
            + tag
          </button>
        </div>
      )}
      {item.tags.length === 0 && (
        <button
          type="button"
          onClick={() => {
            const v = window.prompt("Premier tag");
            if (v && v.trim()) dispatch({ type: "ADD_TAG", sectionIndex, itemIndex, value: v.trim() });
          }}
          className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint transition hover:text-accent"
        >
          + ajouter un tag
        </button>
      )}
    </div>
  );
}
