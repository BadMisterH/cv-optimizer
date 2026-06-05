import type { CVItem, CVSection, OptimizedCV } from "../types";

export type AccentKey = "blue" | "warm" | "green" | "ink";
export type TemplateKey = "classic" | "single";

export const ACCENT_HEX: Record<AccentKey, string> = {
  blue: "#1f4bff",
  warm: "#d97247",
  green: "#1a8a5a",
  ink: "#0f0f10",
};

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  classic: "Classique",
  single: "Une colonne",
};

export type EditorState = {
  cv: OptimizedCV;
  accent: AccentKey;
  template: TemplateKey;
};

type SectionPath = { sectionIndex: number };
type ItemPath = SectionPath & { itemIndex: number };
type BulletPath = ItemPath & { bulletIndex: number };
type TagPath = ItemPath & { tagIndex: number };

export type EditorAction =
  | { type: "MOVE_SECTION"; from: number; to: number }
  | { type: "MOVE_ITEM"; sectionIndex: number; from: number; to: number }
  | { type: "DELETE_SECTION"; sectionIndex: number }
  | { type: "DELETE_ITEM"; sectionIndex: number; itemIndex: number }
  | { type: "ADD_ITEM"; sectionIndex: number }
  | { type: "ADD_BULLET"; sectionIndex: number; itemIndex: number }
  | { type: "DELETE_BULLET"; sectionIndex: number; itemIndex: number; bulletIndex: number }
  | { type: "ADD_TAG"; sectionIndex: number; itemIndex: number; value: string }
  | { type: "DELETE_TAG"; sectionIndex: number; itemIndex: number; tagIndex: number }
  | { type: "EDIT_FULLNAME"; value: string }
  | { type: "EDIT_TITLE"; value: string }
  | { type: "EDIT_ACCROCHE"; value: string }
  | { type: "EDIT_SECTION_TITLE"; sectionIndex: number; value: string }
  | { type: "EDIT_ITEM_FIELD"; sectionIndex: number; itemIndex: number; field: "heading" | "subheading" | "company"; value: string }
  | { type: "EDIT_BULLET"; sectionIndex: number; itemIndex: number; bulletIndex: number; value: string }
  | { type: "EDIT_TAG"; sectionIndex: number; itemIndex: number; tagIndex: number; value: string }
  | { type: "SET_ACCENT"; accent: AccentKey }
  | { type: "SET_TEMPLATE"; template: TemplateKey }
  | { type: "RESET"; cv: OptimizedCV };

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [removed] = copy.splice(from, 1);
  copy.splice(to, 0, removed);
  return copy;
}

function updateItem(
  state: EditorState,
  { sectionIndex, itemIndex }: ItemPath,
  patch: Partial<CVItem>
): EditorState {
  return {
    ...state,
    cv: {
      ...state.cv,
      sections: state.cv.sections.map((s, si) =>
        si !== sectionIndex
          ? s
          : { ...s, items: s.items.map((it, ii) => (ii !== itemIndex ? it : { ...it, ...patch })) }
      ),
    },
  };
}

function updateSection(state: EditorState, sectionIndex: number, patch: Partial<CVSection>): EditorState {
  return {
    ...state,
    cv: {
      ...state.cv,
      sections: state.cv.sections.map((s, i) => (i !== sectionIndex ? s : { ...s, ...patch })),
    },
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "MOVE_SECTION":
      return {
        ...state,
        cv: { ...state.cv, sections: arrayMove(state.cv.sections, action.from, action.to) },
      };

    case "MOVE_ITEM":
      return {
        ...state,
        cv: {
          ...state.cv,
          sections: state.cv.sections.map((s, si) =>
            si !== action.sectionIndex ? s : { ...s, items: arrayMove(s.items, action.from, action.to) }
          ),
        },
      };

    case "DELETE_SECTION":
      return {
        ...state,
        cv: { ...state.cv, sections: state.cv.sections.filter((_, i) => i !== action.sectionIndex) },
      };

    case "DELETE_ITEM":
      return {
        ...state,
        cv: {
          ...state.cv,
          sections: state.cv.sections.map((s, si) =>
            si !== action.sectionIndex ? s : { ...s, items: s.items.filter((_, ii) => ii !== action.itemIndex) }
          ),
        },
      };

    case "ADD_ITEM": {
      const newItem: CVItem = {
        heading: "Nouveau poste",
        subheading: "",
        company: "",
        bullets: ["Décris ici une réalisation concrète."],
        tags: [],
      };
      return {
        ...state,
        cv: {
          ...state.cv,
          sections: state.cv.sections.map((s, si) =>
            si !== action.sectionIndex ? s : { ...s, items: [...s.items, newItem] }
          ),
        },
      };
    }

    case "ADD_BULLET":
      return {
        ...state,
        cv: {
          ...state.cv,
          sections: state.cv.sections.map((s, si) =>
            si !== action.sectionIndex
              ? s
              : {
                  ...s,
                  items: s.items.map((it, ii) =>
                    ii !== action.itemIndex ? it : { ...it, bullets: [...it.bullets, "Nouvelle ligne"] }
                  ),
                }
          ),
        },
      };

    case "DELETE_BULLET":
      return {
        ...state,
        cv: {
          ...state.cv,
          sections: state.cv.sections.map((s, si) =>
            si !== action.sectionIndex
              ? s
              : {
                  ...s,
                  items: s.items.map((it, ii) =>
                    ii !== action.itemIndex
                      ? it
                      : { ...it, bullets: it.bullets.filter((_, bi) => bi !== action.bulletIndex) }
                  ),
                }
          ),
        },
      };

    case "ADD_TAG":
      return {
        ...state,
        cv: {
          ...state.cv,
          sections: state.cv.sections.map((s, si) =>
            si !== action.sectionIndex
              ? s
              : {
                  ...s,
                  items: s.items.map((it, ii) =>
                    ii !== action.itemIndex ? it : { ...it, tags: [...it.tags, action.value] }
                  ),
                }
          ),
        },
      };

    case "DELETE_TAG":
      return {
        ...state,
        cv: {
          ...state.cv,
          sections: state.cv.sections.map((s, si) =>
            si !== action.sectionIndex
              ? s
              : {
                  ...s,
                  items: s.items.map((it, ii) =>
                    ii !== action.itemIndex
                      ? it
                      : { ...it, tags: it.tags.filter((_, ti) => ti !== action.tagIndex) }
                  ),
                }
          ),
        },
      };

    case "EDIT_FULLNAME":
      return { ...state, cv: { ...state.cv, fullName: action.value } };

    case "EDIT_TITLE":
      return { ...state, cv: { ...state.cv, title: action.value } };

    case "EDIT_ACCROCHE":
      return { ...state, cv: { ...state.cv, accroche: action.value } };

    case "EDIT_SECTION_TITLE":
      return updateSection(state, action.sectionIndex, { title: action.value });

    case "EDIT_ITEM_FIELD":
      return updateItem(state, action, { [action.field]: action.value });

    case "EDIT_BULLET":
      return {
        ...state,
        cv: {
          ...state.cv,
          sections: state.cv.sections.map((s, si) =>
            si !== action.sectionIndex
              ? s
              : {
                  ...s,
                  items: s.items.map((it, ii) =>
                    ii !== action.itemIndex
                      ? it
                      : {
                          ...it,
                          bullets: it.bullets.map((b, bi) => (bi !== action.bulletIndex ? b : action.value)),
                        }
                  ),
                }
          ),
        },
      };

    case "EDIT_TAG":
      return {
        ...state,
        cv: {
          ...state.cv,
          sections: state.cv.sections.map((s, si) =>
            si !== action.sectionIndex
              ? s
              : {
                  ...s,
                  items: s.items.map((it, ii) =>
                    ii !== action.itemIndex
                      ? it
                      : {
                          ...it,
                          tags: it.tags.map((t, ti) => (ti !== action.tagIndex ? t : action.value)),
                        }
                  ),
                }
          ),
        },
      };

    case "SET_ACCENT":
      return { ...state, accent: action.accent };

    case "SET_TEMPLATE":
      return { ...state, template: action.template };

    case "RESET":
      return { cv: action.cv, accent: "blue", template: "classic" };

    default:
      return state;
  }
}

// ===== localStorage persistence =====
const DRAFT_KEY = "cv-optimizer:editor-draft";

const VALID_TEMPLATES: TemplateKey[] = ["classic", "single"];

export function readDraft(): EditorState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as EditorState;
    if (!VALID_TEMPLATES.includes(draft.template)) draft.template = "classic";
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(state: EditorState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or disabled, on ignore silencieusement
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}
