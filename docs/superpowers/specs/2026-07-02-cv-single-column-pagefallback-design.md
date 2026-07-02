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

### 2. `app/api/pdf/route.ts` — retrait du blocage, fallback transparent

- La boucle de densité (0 à 4, inchangée) reste le mécanisme de compaction — c'est le "condense d'abord" du prompt, côté rendu.
- Retirer le bloc ajouté plus tôt dans la session qui renvoie une erreur 422 quand `finalPages > 1` après densité max.
- Comportement final : si le CV tient sur 1 page à une densité ≤ 4, on l'expédie comme aujourd'hui. Sinon, on expédie quand même le PDF (potentiellement 2 pages, rendu proprement par le flux naturel de `react-pdf` — pas de troncature, pas de contenu coupé).
- Pas de signal supplémentaire nécessaire dans la réponse (pas de header custom) : la transparence vient de l'aperçu live (§3), qui montre déjà au candidat que son CV dépasse 1 page avant qu'il ne télécharge.

### 3. `app/components/editor/LivePreview.tsx` — retrait du clip dur

Constat : le HTML généré par `lib/cv-html.ts` flue naturellement (pas de hauteur fixe ni d'`overflow: hidden` dans son propre CSS) — tout le clipping vient du wrapper React : une `<div>` avec `overflow-hidden` et une hauteur fixe (`scaledH`, calculée pour correspondre exactement à 1 page A4 mise à l'échelle), plus une `<iframe>` elle-même figée à `height: A4_H`.

Deux approches possibles pour "retirer le clip dur, scroll simple" :
- **Rejetée — doubler la hauteur fixe en permanence** : simple mais dégrade visuellement le cas majoritaire (CV qui tient déjà sur 1 page) avec un grand vide en bas.
- **Retenue — mesure dynamique de la hauteur réelle** : au chargement de l'iframe (`onLoad`), lire `iframe.contentWindow.document.body.scrollHeight` et ajuster la hauteur du conteneur en conséquence (plafonnée à ~2×`A4_H` pour rester borné), avec `overflow-y: auto` à la place d'`overflow-hidden`. Un CV qui tient sur 1 page garde exactement le rendu actuel (hauteur mesurée ≈ A4_H, aucun changement visible). Un CV plus long affiche tout son contenu, scrollable dans la boîte d'aperçu, jamais coupé silencieusement.
- Ce n'est pas une vraie pagination visuelle (pas de séparation par page avec marges/ombres propres à chaque page) — seulement une mesure de hauteur qui empêche la perte silencieuse de contenu. Le mode plein écran (déjà scrollable via `overflow-auto` sur son conteneur, lignes 151-152 actuelles) n'a pas besoin de changement.

---

## Hors périmètre (noté pour plus tard)

- Un vrai template "2 colonnes" (sidebar + colonne principale) comme option de design distincte — chantier de rendu à part entière (react-pdf + HTML/CSS), avec son propre design.
- Vraie pagination visuelle dans l'aperçu live (page 2 visuellement séparée avec ses propres marges) — la mesure dynamique de hauteur (§3) suffit pour l'objectif "ne rien cacher silencieusement", sans reconstruire un système de pagination complet.
- Feedback UX remonté séparément (accès au rechargement de crédits peu visible depuis le menu compte connecté) — sujet distinct, non traité dans cette spec.

---

## Tests à couvrir (pour le plan d'implémentation)

- `app/api/pdf/route.ts` : un CV qui reste à 2 pages même à densité 4 est désormais expédié avec un statut 200 (pas de 422), contenu PDF non tronqué.
- Test manuel/visuel (pas d'automatisation) : `LivePreview.tsx` avec un CV court (1 page) — hauteur du conteneur inchangée par rapport à avant. Avec un CV long (2 pages) — contenu entièrement visible via scroll, pas de coupure nette au niveau d'1 page.
- Prompt : relecture manuelle du `SYSTEM_PROMPT`/`REPAIR_PROMPT` mis à jour pour confirmer l'absence de toute référence résiduelle à "2 colonnes"/"sidebar".
