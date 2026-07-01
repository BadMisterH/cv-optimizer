# Audit de complétude et de fidélité sémantique du CV généré

**Date:** 2026-07-01
**Statut:** Approuvé

---

## Contexte

Le pipeline anti-invention livré le 2026-07-01 (commit `d72aa82`) extrait une "fiche vérité" du CV source (`extractSourceFacts`), génère le CV optimisé à partir de cette fiche (`generateOptimizedCV`), puis valide (`validateOptimizedCV`) : nom, coordonnées, localisation, entreprises citées, dates, chiffres. En cas de violation, un unique retry de réparation est tenté (`REPAIR_PROMPT`), sinon la génération est bloquée (422).

Après déploiement et test réel, l'utilisateur (candidat testeur) remonte 5 problèmes :

1. Relocalisation de l'adresse vers le lieu de l'offre
2. Expérience inventée
3. Faux rattachement à l'entreprise citée dans l'offre
4. Occultation d'un grand nombre d'expériences significatives
5. Expérience dénaturée/exagérée

Les points 1 à 3 sont déjà couverts par `validateContact` / `validateExperienceCompanies` (commit `d72aa82`, pas encore déployé au moment du test). Les points 4 et 5 ne sont couverts par **aucune** validation existante.

**Objectif de cette spec :** combler ces deux trous (complétude, fidélité sémantique) sans faire exploser le coût/latence du cas propre, et sans construire de nouveau chantier de rendu multi-page (voir "Hors périmètre").

Cette révision (suite à relecture) renforce la spec initiale sur 6 points : identifiants stables, texte source brut, définition opérationnelle de "significative", statut strictement pré-filtre du recouvrement lexical, échec net du rendu PDF plutôt qu'un envoi silencieux dégradé, et justification nommée des omissions.

---

## Contrainte produit clarifiée avec l'utilisateur

Le CV doit rester strict à 1 page A4. Aucune vraie pagination 2 pages n'existe aujourd'hui dans le rendu (aperçu `LivePreview.tsx` : boîte A4 fixe et clippée ; PDF `lib/cv-pdf.tsx` + `app/api/pdf/route.ts` : une boucle de densité réduit la police jusqu'à tenir sur 1 page). Construire un vrai support 2 pages est un chantier séparé, pas traité ici.

En conséquence : le modèle doit **prioriser et condenser** pour représenter toutes les expériences significatives, plutôt que de les supprimer silencieusement. Toute omission doit être explicitement et précisément justifiée dans `modifications` (voir §5).

---

## Design

### 0. Modèle de données — identifiants stables et texte source brut

**`sourceFactsSchema.experiences[]` gagne deux champs :**
- `id: string` — identifiant stable généré côté serveur (pas par le modèle) après extraction, ex. `"exp-1"`, `"exp-2"`, dans l'ordre d'apparition. Sert d'ancre exacte pour tout le reste du pipeline.
- `rawText: string` — texte quasi-verbatim de ce bloc d'expérience tel qu'il apparaît dans le CV PDF (avant toute reformulation), extrait par `extractSourceFacts` en plus des champs déjà structurés (`context`, `bullets`). Sert de référence pour le recouvrement lexical et l'audit de fidélité — plus fiable qu'une comparaison contre des champs déjà reformulés par l'extraction elle-même.

**`cvSchema` (CV généré), items de la section Expérience gagnent un champ :**
- `sourceId: string` (obligatoire pour tout item d'une section Expérience) — référence l'`id` de l'expérience source dont cet item est dérivé. Remplace le matching flou par nom d'entreprise (`looselyMatches`) comme mécanisme principal de correspondance.
- Ce champ est **interne au pipeline** : utilisé pour la validation, puis retiré de l'objet `cv` avant de renvoyer la réponse au client (le type `CVItem` exposé au frontend n'a pas besoin de le connaître).

**Validation immédiate et non négociable (heuristique "strong", pas de passage par l'audit) :** si un item d'expérience généré porte un `sourceId` qui ne correspond à aucun `id` de `sourceFacts.experiences`, c'est une violation factuelle certaine (expérience inventée ou mal rattachée) — traitée exactement comme les violations `validateExperienceCompanies` actuelles, sans ambiguïté possible. Le matching par nom d'entreprise (`looselyMatches`) est conservé uniquement comme vérification secondaire de cohérence (le nom d'entreprise affiché doit correspondre à celui de l'expérience source référencée par `sourceId`), pas comme mécanisme principal.

### 1. Définition opérationnelle d'une expérience "significative"

Utilisée à la fois pour guider la génération (prompt) et pour la classification de l'audit (§3). Une expérience source est **significative** si au moins un des critères suivants est vrai :
- Durée ≥ 1 mois à temps plein (ou équivalent), **ou** stage/alternance de toute durée dès lors que la fiche vérité liste des missions concrètes (`bullets` non vide)
- Elle est directement pertinente pour l'offre (compétences/technologies qui recoupent des mots-clés de l'offre)
- Elle fait partie des 3 expériences les plus récentes du candidat
- Elle est la seule expérience du candidat dans un secteur/domaine donné (pas de doublon déjà représenté)

Elle est considérée **non significative** seulement si **toutes** ces conditions sont vraies simultanément :
- Durée < 1 mois **et** aucune mission concrète listée dans la fiche vérité
- Aucune pertinence apparente avec l'offre
- Une expérience très similaire (même rôle/secteur) est déjà représentée ailleurs dans le CV généré

Cette définition est injectée telle quelle dans `SYSTEM_PROMPT`/`REPAIR_PROMPT` (génération) et dans le prompt d'audit (§3), pour que les trois passes utilisent le même référentiel.

### 2. Pré-filtres heuristiques (déterministes, gratuits, toujours exécutés)

**Complétude — `findOmittedExperiences(payload, sourceFacts)`**
Comparaison exacte par `id` : tout `id` de `sourceFacts.experiences` qui n'est référencé par aucun `sourceId` dans les items générés de la section Expérience est un candidat d'omission.

**Fidélité — `findLowFidelityBullets(payload, sourceFacts)`**
Pour chaque bullet généré d'une expérience, calcule un score de recouvrement lexical avec le `rawText` (§0) de l'expérience source correspondante (retrouvée via `sourceId`), normalisé via `normalizeText` déjà existant (tokens significatifs ≥ 4 caractères). Un bullet dont moins d'un tiers des tokens significatifs se retrouvent dans `rawText` est ajouté à `lowOverlapBullets`.

**Invariant non négociable :** `omittedExperiences` et `lowOverlapBullets` sont des listes de *candidats*, jamais des violations. Elles ne sont **jamais** ajoutées directement à `strongViolations` ou `ambiguousNotes`. Leur seul usage possible est d'être passées en entrée à `auditSemanticFidelity` (§3) ; seule la sortie classifiée de l'audit peut alimenter la fusion (§4). Cette règle doit rester vraie même sous contrainte de coût/latence — pas de raccourci futur qui traiterait un faible recouvrement comme une preuve en soi (une reformulation légitime peut avoir un recouvrement lexical faible).

Si `omittedExperiences` et `lowOverlapBullets` sont tous deux vides → arrêt ici, aucun appel LLM supplémentaire.

### 3. Audit sémantique conditionnel (nouvel appel LLM)

Nouvelle fonction `auditSemanticFidelity(client, sourceFacts, payload, omittedExperiences, lowOverlapBullets)`, appelée uniquement si §2 a produit des candidats.

Entrée du prompt : la fiche vérité complète (avec `id`/`rawText`), le CV généré, la liste `modifications`, les deux listes de candidats, et la définition de "significative" (§1).

Le modèle classe chaque candidat en :
- `none` — faux positif (reformulation légitime ; expérience non significative correctement omise et justifiée nommément dans `modifications`, voir §5)
- `ambiguous` — doute subjectif, à signaler au candidat mais pas bloquant
- `strong` — invention/exagération claire, **ou** omission d'une expérience significative (§1) sans justification nommée valable dans `modifications` (§5)

Sortie structurée via `output_config.format: json_schema` :
```json
{ "violations": [{ "severity": "strong" | "ambiguous", "message": "string", "experienceId": "string | null" }] }
```

### 4. Fusion avec le circuit de réparation existant

- Violations heuristiques "dures" (contact, `sourceId` invalide, dates, chiffres) : toujours `strong`, comportement inchangé, jamais soumises à interprétation.
- `strongViolations = violations heuristiques dures + violations sémantiques "strong"` (issues uniquement de l'audit, §2 invariant)
- `ambiguousNotes = violations sémantiques "ambiguous"`
- Si `strongViolations` non vide → retry unique existant (`generateOptimizedCV` + `REPAIR_PROMPT`, liste élargie). Après le retry, on ré-exécute §2 (pré-filtres) puis §3 (audit conditionnel) une seconde fois.
- Après ce (seul) retry : si `strongViolations` persiste → blocage 422 (comportement actuel, message étendu).
- Si seules des `ambiguousNotes` subsistent → CV renvoyé normalement, notes attachées à la réponse.

### 5. Justification précise des omissions dans `modifications`

Une omission n'est considérée **justifiée** que si `modifications` contient une entrée qui **nomme explicitement** l'expérience omise (nom d'entreprise et/ou intitulé du poste — l'identité lisible par un humain, pas l'`id` interne) accompagnée d'une raison concrète (ex. *"Expérience chez Acme Corp (2015, Vendeur) non retenue : trop ancienne et hors périmètre de l'offre"*). Une justification vague ou générique ("CV condensé pour tenir sur une page") ne compte pas comme justification valable pour une expérience significative — l'audit doit alors classer l'omission en `strong`, même si le raisonnement métier derrière l'omission était par ailleurs raisonnable : l'exigence de transparence nommée est une condition à part entière, pas seulement la légitimité de l'omission elle-même.

### 6. Nouveau champ de réponse

`OptimizeResponse.reviewFlags: string[]` (app/types.ts) — rempli avec `ambiguousNotes` (tableau vide si rien à signaler).

### 7. UI (changement minimal, réutilisation d'un pattern existant)

`app/components/ATSInterpretation.tsx` a déjà un bloc "Risques de lecture" (`parsingRisks`, ton `warm`). On ajoute un bloc sœur "À vérifier avant envoi" alimenté par `reviewFlags`, même style. Câblage : `app/optimiser/page.tsx` (~ligne 526) transmet aussi `reviewFlags`. Pas de nouveau composant.

### 8. Fiabilité du rendu PDF — ne jamais expédier silencieusement un PDF hors-format

Constat (recherche préalable) : `app/api/pdf/route.ts` (lignes ~32-57) tente les densités 0 à 4 pour faire tenir le CV sur 1 page (`countPdfPages`), mais si la densité 4 produit encore plus d'1 page, le PDF est **expédié tel quel, silencieusement**, sans avertissement.

Changement : si après la densité maximale (4) le PDF compte toujours plus d'une page, la route **ne renvoie pas le PDF**. Elle répond avec une erreur claire (ex. 422, `{ error: "Le CV dépasse une page même à la densité maximale. Réduis le contenu (bullets, nombre d'expériences) avant de générer le PDF." }`), symétrique au traitement d'erreur déjà en place côté `/api/optimize`. Le flux frontend qui déclenche l'export PDF doit afficher cette erreur (à vérifier/adapter lors du plan : reprendre le pattern d'affichage d'erreur déjà utilisé pour `/api/optimize`).

Ce point est indépendant de la génération de contenu (§0-§7) mais répond au même principe : ne jamais dégrader silencieusement une garantie annoncée au candidat (ici, "tient sur 1 page").

### 9. Ajustements de prompt (`SYSTEM_PROMPT` / `REPAIR_PROMPT` / `SOURCE_FACTS_PROMPT`)

- `SOURCE_FACTS_PROMPT` : instruire l'extraction de `rawText` par expérience (texte quasi-verbatim du bloc), en plus des champs structurés existants.
- `SYSTEM_PROMPT`/`REPAIR_PROMPT` : remplacer le plafond rigide "3 à 5 expériences" par la définition de "significative" (§1) — couvrir toutes les expériences significatives et pertinentes pour l'offre, en condensant plutôt qu'en supprimant.
- Exiger que chaque item d'expérience généré porte un `sourceId` valide.
- Exiger que toute omission soit nommément justifiée dans `modifications` (§5).
- Interdiction explicite d'exagérer le niveau de responsabilité, le périmètre ou l'impact d'une mission au-delà de ce qu'indique `rawText`/`bullets`/`context` de la fiche vérité.

---

## Impact coût/latence

- Génération propre (cas majoritaire visé) : toujours 2 appels LLM (extraction + génération), identique à aujourd'hui.
- Génération avec candidats suspects : +1 appel d'audit, et éventuellement +1 retry de réparation (déjà existant aujourd'hui) — pire cas comparable au pire cas actuel + 1 appel.
- `app/api/pdf/route.ts` : aucun appel LLM supplémentaire, juste un changement de comportement en fin de boucle de densité existante.

---

## Hors périmètre (noté pour plus tard)

- Vrai rendu multi-page (aperçu `LivePreview.tsx` + PDF `lib/cv-pdf.tsx`/`app/api/pdf/route.ts`) : chantier séparé.
- Similarité sémantique par embeddings : recouvrement lexical (pré-filtre, jamais décisif seul) + jugement LLM (audit) suffisent ; pas de pipeline NLP dédié.

---

## Tests à couvrir (pour le plan d'implémentation)

- Cas propre : aucune expérience omise (tous les `id` référencés), tous les bullets bien alignés avec `rawText` → pas d'appel d'audit, `reviewFlags` vide.
- `sourceId` généré invalide/inconnu → violation heuristique "strong" immédiate, sans passer par l'audit.
- Expérience significative (§1) omise sans entrée nommée dans `modifications` → audit classe `strong` → repair retry → si toujours omise ou toujours pas nommée, 422.
- Expérience non significative omise avec justification nommée correcte dans `modifications` → audit classe `none`, pas de blocage.
- Omission avec justification vague/générique (ne nomme pas l'expérience) → classée `strong` par l'audit même si le fond était raisonnable (§5).
- Bullet exagérant clairement une responsabilité absente de `rawText` → `strong` → repair retry.
- Bullet reformulé légitimement mais à faible recouvrement lexical avec `rawText` → audit classe `none` ou `ambiguous`, jamais bloquant à tort (invariant §2).
- Cas ambigu persistant après retry → CV renvoyé avec `reviewFlags` non vide, pas de 422.
- `/api/pdf` : CV qui dépasse toujours 1 page à densité 4 → réponse d'erreur claire, aucun PDF hors-format n'est expédié.
