# Alignement prompt/rendu sur 1 colonne ATS + fallback 2 pages transparent

**Date:** 2026-07-02
**Statut:** Approuvé

---

## Contexte

Le `SYSTEM_PROMPT` (`app/api/optimize/route.ts`) décrit depuis longtemps une mise en page A4 "deux colonnes" (sidebar gauche : Compétences/Langues/Formation/Centres d'intérêt — colonne principale droite : Accroche/Expérience/Projets). Or **aucun des deux renderers ne l'a jamais implémentée** : `lib/cv-pdf.tsx` (PDF via `@react-pdf/renderer`) et `lib/cv-html.ts` (aperçu live) empilent tous les deux les sections en une seule colonne (`cv.sections.map(...)`), sans grille ni sidebar.

Ce décalage était auparavant masqué par deux comportements corrigés dans la session du jour :
1. Le modèle pouvait supprimer silencieusement des sections entières (Compétences, Formation) pour "faire de la place" — corrigé par `validateRequiredSections`/`validateProjectsProvenance`.
2. `/api/pdf` expédiait silencieusement un PDF de plus d'une page si la boucle de densité n'arrivait pas à le faire tenir sur 1 page — corrigé par un blocage 422 explicite.

En combinant les deux corrections, le décalage 2-colonnes-promises/1-colonne-réelle devient visible et bloquant : un CV avec un contenu par ailleurs raisonnable (2 expériences, 4 sous-catégories de compétences, 2 formations, langues, centres d'intérêt) dépasse 1 page même à densité maximale (la réduction de police ne va que d'environ 10.5 à 9.3, ~11 % — largement insuffisant pour compenser l'absence de mise en page 2 colonnes), et se fait bloquer par l'erreur 422.

**Décision produit :** le template actuel reste en 1 colonne par défaut — c'est en fait le choix le plus sûr pour la compatibilité ATS (beaucoup de parseurs ATS lisent mal les CV multi-colonnes, l'ordre d'extraction du texte peut être faussé). Un éventuel template "Design 2 colonnes" pourra être ajouté plus tard comme option distincte, avec son propre travail de rendu — hors périmètre ici. Cette spec corrige le décalage prompt/rendu (le prompt ne doit plus promettre ce qu'il ne construit pas) et ajoute un vrai filet de secours transparent quand le contenu légitime ne tient pas sur 1 page même condensé au maximum.

---

## Design

### 1. Prompt (`SYSTEM_PROMPT` / `REPAIR_PROMPT`, `app/api/optimize/route.ts`)

- Retirer toute référence à une mise en page 2 colonnes / sidebar (y compris "Formations (en sidebar)" et la consigne d'équilibrage de hauteur entre colonnes gauche/droite).
- Remplacer par une structure 1 colonne explicite, dans cet ordre, sections seulement si présentes dans la fiche vérité : Titre → Accroche → Expérience → Projets (si `sourceFacts.projects` non vide) → Compétences → Formation → Langues → Centres d'intérêt.
- Reformuler l'objectif de mise en page : condenser agressivement en premier recours (bullets plus courts, moins de tags par sous-catégorie) ; si le contenu significatif ne tient toujours pas sur 1 page A4 même condensé au maximum, une 2ᵉ page propre est acceptable — ça doit rester l'exception, pas la norme.
- Retirer la clause ajoutée plus tôt dans la session qui ne protégeait que les expériences de l'omission sous contrainte de place (`"Si le nombre d'expériences significatives rend ça impossible..."`) : elle est maintenant redondante avec la règle générale (toutes les sections avec contenu source doivent être condensées, jamais supprimées) et avec le nouveau fallback 2 pages général.

### 2. `app/api/pdf/route.ts` — retrait du blocage strict à 1 page, plafond dur à 2 pages

- La boucle de densité (0 à 4, inchangée) reste le mécanisme de compaction — c'est le "condense d'abord" du prompt, côté rendu.
- Nouveau seuil, sur `finalPages` (comptage réel via `countPdfPages`, inchangé) :
  - `finalPages === 1` → expédié comme aujourd'hui.
  - `finalPages === 2` → expédié aussi (nouveau fallback, remplace l'ancien blocage 422 systématique dès qu'on dépassait 1 page).
  - `finalPages >= 3` → **jamais expédié silencieusement**. Le contenu n'est plus un "CV optimisé" à ce stade, c'est un problème de volume de contenu.
- **Choix d'architecture pour le cas ≥ 3 pages : renvoyer une erreur claire, pas relancer une réparation IA.** `/api/pdf/route.ts` est un renderer pur (prend un `cv` JSON déjà généré, produit un buffer PDF) — il n'a aucun accès à l'API Anthropic et ne doit pas en avoir (coupler le renderer à la génération de contenu casserait la séparation actuelle des responsabilités entre `/api/optimize` — qui décide QUOI écrire — et `/api/pdf` — qui décide comment le mettre en page). La condensation de contenu est une décision qui appartient au pipeline de génération, pas au renderer. Donc : erreur 422 avec message actionnable (ex: *"Ce CV est trop long pour être exporté proprement (3 pages et plus même à densité maximale). Retire des bullets ou des expériences moins prioritaires dans l'éditeur avant de réessayer."*), sans tentative de réparation automatique depuis cette route.
- Toujours pas de signal supplémentaire nécessaire pour le cas 2 pages accepté (pas de header custom) : la transparence vient de l'aperçu live (§3), qui montre déjà au candidat que son CV dépasse 1 page avant qu'il ne télécharge.

### 3. `app/components/editor/LivePreview.tsx` — retrait du clip dur, sans en recréer un autre

Constat : le HTML généré par `lib/cv-html.ts` flue naturellement (pas de hauteur fixe ni d'`overflow: hidden` dans son propre CSS) — tout le clipping vient du wrapper React : une `<div>` avec `overflow-hidden` et une hauteur fixe (`scaledH`, calculée pour correspondre exactement à 1 page A4 mise à l'échelle), plus une `<iframe>` elle-même figée à `height: A4_H`.

**Principe clé : le plafond visuel (scroll) et la hauteur réelle du contenu sont deux choses séparées, il ne faut pas les confondre.**
- **`<iframe>`** : sa hauteur doit toujours correspondre à la hauteur RÉELLE mesurée du contenu (`scrollHeight`), **sans plafond**. Si on limitait la hauteur de l'iframe elle-même (ex: à 2×`A4_H`), on recréerait exactement le même bug qu'aujourd'hui — juste avec un seuil plus haut : tout contenu au-delà resterait invisible et coupé silencieusement, contrairement à l'objectif de cette spec.
- **Le conteneur wrapper** (la `<div>` autour de l'iframe) : lui peut avoir un `max-height` (borne purement visuelle/ergonomique, pour éviter qu'une boîte d'aperçu ne prenne toute la page — par exemple liée au viewport, `max-height: 80vh`) combiné à `overflow-y: auto`. La hauteur de l'iframe à l'intérieur reste celle du contenu réel ; si elle dépasse le `max-height` du wrapper, une scrollbar apparaît sur le wrapper — mais rien n'est caché, tout reste atteignable en scrollant.
- Rejeté : doubler/plafonner la hauteur fixe de l'iframe en permanence à une valeur arbitraire — dégraderait visuellement le cas majoritaire (CV qui tient sur 1 page, gros vide en bas) ET recréerait un clip caché pour tout contenu dépassant ce plafond.

**Mesure robuste de la hauteur** (l'iframe contient des web fonts et un flux de blocs — une mesure prise trop tôt sous-estime la hauteur réelle) :
1. Mesure initiale sur l'évènement `onLoad` de l'iframe (`iframe.contentDocument.documentElement.scrollHeight` ou `.body.scrollHeight`).
2. Re-mesure via `requestAnimationFrame` après le `onLoad`, pour laisser le navigateur terminer un cycle de layout avant de lire la valeur.
3. Si disponible, attendre `iframe.contentDocument.fonts.ready` avant une mesure finale — les web fonts (polices custom du CV) peuvent finir de charger après le `onLoad` et changer la hauteur du texte.
4. Mettre en place un `ResizeObserver` sur `iframe.contentDocument.body` (ou `documentElement`) pour capter tout changement de hauteur ultérieur (chargement différé, changement de contenu) et remettre à jour la hauteur du conteneur en continu, pas seulement au chargement initial.

Ce n'est pas une vraie pagination visuelle (pas de séparation par page avec marges/ombres propres à chaque page) — seulement une mesure de hauteur fiable qui empêche la perte silencieuse de contenu. Le mode plein écran (déjà scrollable via `overflow-auto` sur son conteneur, lignes 151-152 actuelles) n'a pas besoin de changement structurel, seulement de bénéficier de la même mesure de hauteur si l'iframe y est aussi contrainte à une taille fixe.

---

## Hors périmètre (noté pour plus tard)

- Un vrai template "2 colonnes" (sidebar + colonne principale) comme option de design distincte — chantier de rendu à part entière (react-pdf + HTML/CSS), avec son propre design.
- Vraie pagination visuelle dans l'aperçu live (page 2 visuellement séparée avec ses propres marges) — la mesure dynamique de hauteur (§3) suffit pour l'objectif "ne rien cacher silencieusement", sans reconstruire un système de pagination complet.
- Feedback UX remonté séparément (accès au rechargement de crédits peu visible depuis le menu compte connecté) — sujet distinct, non traité dans cette spec.

---

## Tests à couvrir (pour le plan d'implémentation)

- `app/api/pdf/route.ts` :
  - `finalPages === 1` → statut 200, comportement inchangé.
  - `finalPages === 2` → statut 200 (nouveau), contenu PDF non tronqué.
  - `finalPages >= 3` → statut 422 avec message actionnable, PDF jamais expédié.
- Test manuel/visuel (pas d'automatisation, composant client avec iframe/mesure DOM difficilement testable unitairement) : `LivePreview.tsx` avec un CV court (1 page) — hauteur du conteneur inchangée par rapport à avant. Avec un CV moyen (2 pages) — contenu entièrement visible via scroll, pas de coupure nette au niveau d'1 page. Vérifier explicitement que l'iframe elle-même n'est jamais plus petite que le contenu réel (inspecter en DevTools que `scrollHeight` de l'iframe correspond à sa hauteur CSS appliquée, pas seulement à ce qui est visible dans le wrapper).
- Prompt : relecture manuelle du `SYSTEM_PROMPT`/`REPAIR_PROMPT` mis à jour pour confirmer l'absence de toute référence résiduelle à "2 colonnes"/"sidebar".
