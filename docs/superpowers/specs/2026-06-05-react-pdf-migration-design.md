# Migration Puppeteer → @react-pdf/renderer

**Date:** 2026-06-05
**Statut:** Approuvé

---

## Contexte

La génération PDF actuelle utilise Puppeteer (headless Chrome) pour convertir un template HTML/CSS en PDF. Problèmes identifiés :

- Démarrage Chromium lent (~3-5s par génération)
- Rendu navigateur imprévisible (bugs CSS, polices système, print quirks)
- Dépendances lourdes (`puppeteer`, `@sparticuz/chromium-min`)
- Qualité typographique inférieure à un moteur PDF natif

**Objectif :** Remplacer Puppeteer par `@react-pdf/renderer` pour un PDF propre, rapide, sans navigateur.

---

## Contrainte non négociable

**Le CV doit toujours tenir sur exactement 1 page A4.** La pagination naturelle de react-pdf (2+ pages) n'est pas acceptable.

---

## Architecture retenue

### Couche PDF : densité itérative

```
renderPdf(cv, density=0)
  → buffer PDF
  → count pages (regex sur buffer)
  → 1 page ? → retourner le buffer
  → > 1 page ? → renderPdf(cv, density+1)
  → density > 4 ? → renderPdf(cv, density=4, scale=fit)
```

Chaque passe react-pdf ≈ 200ms. 5 passes max ≈ 1s — plus rapide que Puppeteer.

### Comptage de pages

Sans dépendance : on parse le buffer PDF avec une regex simple.

```ts
function countPdfPages(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}
```

### Scale de dernier recours

Si density-4 déborde encore (CV très long), on applique un scale `< 1` via la prop `scale` de react-pdf. Plancher : `0.75`.

---

## Fichiers créés / modifiés

| Fichier | Action | Description |
|---|---|---|
| `lib/cv-pdf.tsx` | **Créer** | Composants react-pdf du template CV |
| `app/api/pdf/route.ts` | **Modifier** | Remplacer Puppeteer par `renderToBuffer` |
| `lib/cv-html.ts` | **Inchangé** | Conservé pour la preview HTML (iframe) |
| `lib/browser.ts` | **Supprimer** | Plus utilisé |
| `package.json` | **Modifier** | Ajouter `@react-pdf/renderer`, retirer `puppeteer` + `@sparticuz/chromium-min` |

---

## Détail : `lib/cv-pdf.tsx`

### Densités (5 niveaux)

Chaque niveau définit un objet de styles. Le niveau 0 est spacieux, le niveau 4 est compact.

```
density 0 : fs=10.5, lh=1.45, sectionGap=10, itemGap=7,  padY=14, titleFs=20
density 1 : fs=10.3, lh=1.42, sectionGap=8,  itemGap=6,  padY=11, titleFs=19
density 2 : fs=10.0, lh=1.38, sectionGap=6,  itemGap=5,  padY=9,  titleFs=18
density 3 : fs=9.7,  lh=1.33, sectionGap=5,  itemGap=4,  padY=7,  titleFs=17
density 4 : fs=9.3,  lh=1.28, sectionGap=4,  itemGap=3,  padY=5,  titleFs=16
```

### Composants

```
<CVDocument>              ← <Document> react-pdf, reçoit cv + density + scale + accentColor
  <Page size="A4">
    <CVHeader>            ← nom, titre, contact, photo
    <CVAccroche>          ← si cv.accroche présent
    <CVSection>           ← répété pour chaque cv.sections[]
      <CVItem>            ← répété pour chaque section.items[]
        <CVItemHeader>    ← heading, company, subheading/date
        <CVBullets>       ← liste de bullets
        <CVTags>          ← chips de compétences
```

### Templates

- **classic** : header aligné gauche, photo à droite
- **single** : header centré, photo au-dessus du nom

Géré via une prop `template: "classic" | "single"` sur `<CVDocument>`.

### Polices

react-pdf inclut Helvetica (14 variantes). On l'utilise directement — zéro font à télécharger.

### Photo

Prop `photoDataUrl?: string`. react-pdf accepte les data URLs base64 dans `<Image>`.

### Couleur accent

Prop `accentColor: string` (#hex). Utilisée pour : barre header, titres de sections, bullets, chips.

---

## Détail : `/api/pdf/route.ts`

```ts
async function renderAtDensity(cv, photo, accentColor, template, density, scale = 1) {
  const buf = await renderToBuffer(
    <CVDocument cv={cv} photo={photo} accentColor={accentColor}
                template={template} density={density} scale={scale} />
  );
  return buf;
}

export async function POST(req) {
  // ... parse body (cv, photo, accentColor, template)

  for (let d = 0; d <= 4; d++) {
    const buf = await renderAtDensity(cv, photo, accentColor, template, d);
    if (countPdfPages(buf) <= 1) return pdfResponse(buf, cv.fullName);
  }

  // Dernier recours : scale down calculé
  // On compte les pages du density-4 pour estimer le scale nécessaire.
  const buf4 = await renderAtDensity(cv, photo, accentColor, template, 4);
  const pages = countPdfPages(buf4);
  // Scale = 1/pages donne un fit approximatif. Plancher 0.75.
  const scale = Math.max(0.75, 1 / pages);
  const scaledBuf = await renderAtDensity(cv, photo, accentColor, template, 4, scale);
  return pdfResponse(scaledBuf, cv.fullName);
}
```

> Note : `renderToBuffer` est la fonction server-side de `@react-pdf/renderer`. Elle retourne un `Buffer`.

---

## Preview HTML : aucun changement

`lib/cv-html.ts` et `LivePreview.tsx` restent inchangés. Le libellé "↪ pixel-perfect du PDF" est mis à jour en "↪ aperçu du rendu final" pour refléter honnêtement la légère différence de rendu.

---

## Suppression de Puppeteer

Après migration validée :
- Retirer `puppeteer`, `puppeteer-core`, `@sparticuz/chromium-min` de `package.json`
- Supprimer `lib/browser.ts`
- Vérifier que `next.config` ne contient plus de références Puppeteer

---

## Hors périmètre

- Migration de la preview live vers react-pdf (trop lourd pour du temps réel)
- Migration de la lettre de motivation PDF (`/api/letter-pdf`) — dans un second temps
- Nouveaux templates CV

---

## Critères de succès

1. `POST /api/pdf` retourne toujours un PDF 1 page A4
2. Temps de génération < 2s pour density-0, < 5s pour le pire cas (5 passes)
3. Puppeteer retiré des dépendances
4. Preview HTML continue de fonctionner sans changement
5. Photo, accent couleur, 2 templates : tous supportés
