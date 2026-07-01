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

Les points 1 à 3 sont déjà couverts par `validateContact` / `validateExperienceCompanies` (commit `d72aa82`, pas encore déployé au moment du test). Les points 4 et 5 ne sont couverts par **aucune** validation existante : rien ne vérifie qu'une expérience significative du CV source est bien représentée dans le CV généré, et rien ne vérifie la fidélité sémantique du contenu d'un bullet par rapport aux faits source (seuls les chiffres et les années sont vérifiés, pas le sens).

**Objectif de cette spec :** combler ces deux trous (complétude, fidélité sémantique) sans faire exploser le coût/latence du cas propre, et sans construire de nouveau chantier de rendu (voir "Hors périmètre").

---

## Contrainte produit clarifiée avec l'utilisateur

Le CV doit rester strict à 1 page A4. Aucune vraie pagination 2 pages n'existe aujourd'hui dans le rendu (aperçu `LivePreview.tsx` : boîte A4 fixe et clippée, pas de découpe par page ; PDF `lib/cv-pdf.tsx` + `app/api/pdf/route.ts` : une boucle de densité réduit la police jusqu'à tenir sur 1 page, et si ça échoue quand même, un PDF 2 pages non prévu est expédié silencieusement). Construire un vrai support 2 pages est un chantier séparé, pas traité ici.

En conséquence : le modèle doit **prioriser et condenser** (moins de bullets, formulations plus courtes) pour représenter toutes les expériences professionnellement significatives et pertinentes pour l'offre, plutôt que de les supprimer silencieusement. Toute omission doit être explicitement justifiée dans `modifications`.

---

## Design

### 1. Pré-filtres heuristiques (déterministes, gratuits, toujours exécutés)

**Complétude — `findOmittedExperiences(payload, sourceFacts)`**
Réutilise la logique de correspondance entreprise déjà présente (`looselyMatches` / `findSourceExperienceByCompany`). Retourne la liste des expériences de `sourceFacts.experiences` dont l'entreprise n'apparaît dans aucun item de la section Expérience du CV généré.

**Fidélité — `findLowFidelityBullets(payload, sourceFacts)`**
Pour chaque bullet généré d'une expérience, calcule un score de recouvrement lexical avec le texte source de l'expérience correspondante (`context` + `bullets` concaténés, normalisés via `normalizeText` déjà existant : tokens significatifs ≥ 4 caractères). Un bullet dont moins d'un tiers des tokens significatifs se retrouvent dans le texte source est ajouté à `lowOverlapBullets` (candidat, pas une violation certaine — la reformulation légitime peut avoir un recouvrement lexical faible).

Si `omittedExperiences` et `lowOverlapBullets` sont tous deux vides → on s'arrête ici, aucun appel LLM supplémentaire n'est fait.

### 2. Audit sémantique conditionnel (nouvel appel LLM)

Nouvelle fonction `auditSemanticFidelity(client, sourceFacts, payload, omittedExperiences, lowOverlapBullets)`, appelée uniquement si l'étape 1 a produit des candidats.

Entrée du prompt : la fiche vérité complète, le CV généré, la liste `modifications` (pour vérifier si une omission a été honnêtement expliquée), et les deux listes de candidats.

Le modèle classe chaque candidat en :
- `none` — faux positif (reformulation légitime, expérience mineure correctement omise et déjà justifiée dans `modifications`)
- `ambiguous` — doute subjectif, à signaler au candidat mais pas bloquant
- `strong` — invention/exagération claire, ou omission d'une expérience manifestement significative et pertinente sans justification valable

Sortie structurée via `output_config.format: json_schema` (même mécanisme que le reste du pipeline) :
```json
{ "violations": [{ "severity": "strong" | "ambiguous", "message": "string" }] }
```

### 3. Fusion avec le circuit de réparation existant

- Les violations heuristiques actuelles (`validateOptimizedCV` : contact, entreprise, dates, chiffres) restent toujours `strong`, comportement inchangé.
- `strongViolations = violations heuristiques + violations sémantiques "strong"`
- `ambiguousNotes = violations sémantiques "ambiguous"`
- Si `strongViolations` non vide → retry unique existant (`generateOptimizedCV` avec `REPAIR_PROMPT`, liste de violations élargie aux violations sémantiques strong). Après le retry, on ré-exécute étape 1 (pré-filtres) puis étape 2 (audit conditionnel) une seconde fois.
- Après ce (seul) retry : si `strongViolations` persiste → blocage 422 (comportement actuel, message étendu aux violations sémantiques).
- Si seules des `ambiguousNotes` subsistent → le CV est renvoyé normalement, avec ces notes attachées à la réponse.

### 4. Nouveau champ de réponse

`OptimizeResponse.reviewFlags: string[]` (app/types.ts) — rempli avec `ambiguousNotes` (tableau vide si rien à signaler). Documenté comme "points à vérifier avant envoi" dans le type (commentaire JSDoc, même style que les champs `ATSInterpretation` existants).

### 5. UI (changement minimal, réutilisation d'un pattern existant)

`app/components/ATSInterpretation.tsx` a déjà un bloc "Risques de lecture" (`parsingRisks`, ton `warm`, liste à puces avec état vide). On ajoute un bloc sœur "À vérifier avant envoi" alimenté par `reviewFlags`, même style visuel. Câblage : `app/optimiser/page.tsx` (~ligne 526, où `atsInterpretation` est déjà passé en props) transmet aussi `reviewFlags`. Pas de nouveau composant.

### 6. Ajustements de prompt (`SYSTEM_PROMPT` / `REPAIR_PROMPT`)

- Remplacer le plafond rigide "3 à 5 expériences" par une consigne de priorisation : couvrir toutes les expériences professionnellement significatives et pertinentes pour l'offre, en condensant (bullets plus courts, 1 au lieu de 2-3) plutôt qu'en supprimant.
- Exiger qu'une omission soit toujours explicitement motivée dans `modifications` avec une raison concrète (ancienneté, hors périmètre, doublon de compétences déjà couvert ailleurs).
- Interdiction explicite d'exagérer le niveau de responsabilité, le périmètre ou l'impact d'une mission au-delà de ce que la fiche vérité indique (au-delà des chiffres, déjà couverts).

---

## Impact coût/latence

- Génération propre (cas majoritaire visé) : toujours 2 appels LLM (extraction + génération), identique à aujourd'hui.
- Génération avec candidats suspects : +1 appel d'audit, et éventuellement +1 retry de réparation (déjà existant aujourd'hui pour les violations factuelles) — pire cas comparable au pire cas actuel + 1 appel.

---

## Hors périmètre (noté pour plus tard)

- Vrai rendu multi-page (aperçu `LivePreview.tsx` + PDF `lib/cv-pdf.tsx`/`app/api/pdf/route.ts`) : chantier séparé, chiffré à part si besoin un jour.
- Similarité sémantique par embeddings : le recouvrement lexical (pré-filtre) + jugement LLM (audit) suffisent pour ce cas d'usage ; pas de pipeline NLP dédié.

---

## Tests à couvrir (pour le plan d'implémentation)

- Cas propre : aucune expérience omise, tous les bullets bien alignés → pas d'appel d'audit, `reviewFlags` vide.
- Expérience significative omise sans justification dans `modifications` → audit renvoie `strong` → repair retry → si toujours omise, 422.
- Expérience mineure omise avec justification correcte dans `modifications` → audit renvoie `none`, pas de blocage.
- Bullet exagérant clairement une responsabilité non présente dans la fiche vérité → `strong` → repair retry.
- Bullet reformulé légitimement mais avec faible recouvrement lexical → audit renvoie `none` ou `ambiguous`, jamais bloquant à tort.
- Cas ambigu persistant après retry → CV renvoyé avec `reviewFlags` non vide, pas de 422.
