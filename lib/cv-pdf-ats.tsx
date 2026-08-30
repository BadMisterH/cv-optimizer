import "server-only";
import React from "react";
import { Page, View, Text, Link } from "@react-pdf/renderer";
import type { OptimizedCV } from "@/app/types";
import { buildContactItems } from "./cv-pdf-shared";

/**
 * Template « ATS strict » — reproduction du resume classique noir & blanc
 * largement recommandé pour passer les filtres automatisés.
 *
 * Parti pris assumé, et c'est tout l'intérêt du template : aucune couleur,
 * aucune photo, aucune pastille, aucune mise en page sur deux colonnes. Tout
 * le contenu est un flux de texte linéaire que n'importe quel parseur lit dans
 * l'ordre. La couleur d'accent choisie dans l'éditeur est volontairement
 * ignorée ici.
 */

// Noir pur : c'est un document imprimable, pas une interface.
const BLACK = "#000000";

interface AtsDensity {
  bodyFs: number;
  lineHeight: number;
  nameFs: number;
  titleFs: number;
  contactFs: number;
  sectionTitleFs: number;
  sectionGap: number;
  sectionTitleMb: number;
  itemGap: number;
  /** Écart pour les items d'une seule ligne (formation, langues) — la
   *  référence les serre nettement plus que les blocs à puces. */
  compactItemGap: number;
  bulletMb: number;
  padY: number;
  padX: number;
  headerMb: number;
}

// Plancher volontaire sur lineHeight (1.25) et padY (20) : même au niveau le
// plus compact, le texte garde une interligne lisible et la page des marges.
// La compaction vient des espaces entre blocs, pas de l'écrasement du texte.
const ATS_DENSITIES: AtsDensity[] = [
  { bodyFs: 10,   lineHeight: 1.40, nameFs: 21,   titleFs: 11,   contactFs: 9.5, sectionTitleFs: 12,   sectionGap: 9,   sectionTitleMb: 4,   itemGap: 7,   compactItemGap: 2.5, bulletMb: 1.5, padY: 32, padX: 34, headerMb: 10 },
  { bodyFs: 9.7,  lineHeight: 1.37, nameFs: 20,   titleFs: 10.6, contactFs: 9.2, sectionTitleFs: 11.5, sectionGap: 7.5, sectionTitleMb: 3.5, itemGap: 6,   compactItemGap: 2,   bulletMb: 1,   padY: 28, padX: 34, headerMb: 8.5 },
  { bodyFs: 9.4,  lineHeight: 1.33, nameFs: 19,   titleFs: 10.2, contactFs: 9,   sectionTitleFs: 11.2, sectionGap: 6.5, sectionTitleMb: 3,   itemGap: 5,   compactItemGap: 1.5, bulletMb: 0.5, padY: 25, padX: 32, headerMb: 7 },
  { bodyFs: 9.1,  lineHeight: 1.29, nameFs: 18,   titleFs: 9.8,  contactFs: 8.6, sectionTitleFs: 10.8, sectionGap: 5.5, sectionTitleMb: 2.5, itemGap: 4,   compactItemGap: 1,   bulletMb: 0,   padY: 22, padX: 30, headerMb: 6 },
  { bodyFs: 8.8,  lineHeight: 1.25, nameFs: 17,   titleFs: 9.4,  contactFs: 8.3, sectionTitleFs: 10.4, sectionGap: 4.5, sectionTitleMb: 2,   itemGap: 3,   compactItemGap: 0.5, bulletMb: 0,   padY: 20, padX: 28, headerMb: 5 },
];

// ─── En-tête ──────────────────────────────────────────────────────────────────

function AtsHeader({ cv, d }: { cv: OptimizedCV; d: AtsDensity }) {
  const contactItems = buildContactItems(cv.contact, { bareUrls: true });

  return (
    <View style={{ marginBottom: d.headerMb }}>
      {/* lineHeight explicite sur chaque ligne de l'en-tête : sans elle, les
          grandes tailles héritent de l'interligne du corps et se chevauchent. */}
      <Text
        style={{
          fontSize: d.nameFs,
          lineHeight: 1.2,
          fontWeight: 700,
          textAlign: "center",
          color: BLACK,
          marginBottom: 2,
        }}
      >
        {cv.fullName}
      </Text>

      {cv.title ? (
        <Text
          style={{
            fontSize: d.titleFs,
            lineHeight: 1.3,
            textAlign: "center",
            color: BLACK,
            marginBottom: 2,
          }}
        >
          {cv.title}
        </Text>
      ) : null}

      {contactItems.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {contactItems.map((item, i) => (
            <View key={i} style={{ flexDirection: "row" }}>
              {i > 0 && (
                // Marge plutôt qu'espaces littéraux : react-pdf rogne les
                // espaces en début/fin de nœud texte, le séparateur collerait.
                <Text
                  style={{
                    fontSize: d.contactFs,
                    lineHeight: 1.4,
                    color: BLACK,
                    marginHorizontal: 4,
                  }}
                >
                  |
                </Text>
              )}
              {item.kind === "link" ? (
                <Link
                  src={item.href}
                  style={{
                    fontSize: d.contactFs,
                    lineHeight: 1.4,
                    color: BLACK,
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </Link>
              ) : (
                <Text style={{ fontSize: d.contactFs, lineHeight: 1.4, color: BLACK }}>
                  {item.label}
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Titre de section ─────────────────────────────────────────────────────────
// Casse normale (pas de majuscules forcées), filet pleine largeur en dessous :
// c'est la signature visuelle de ce template.

function AtsSectionTitle({ label, d }: { label: string; d: AtsDensity }) {
  return (
    <View
      style={{
        borderBottomWidth: 0.75,
        borderBottomColor: BLACK,
        paddingBottom: 1.5,
        marginBottom: d.sectionTitleMb,
      }}
    >
      <Text style={{ fontSize: d.sectionTitleFs, color: BLACK }}>{label}</Text>
    </View>
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────────

function AtsItem({
  item,
  d,
  isLast,
}: {
  item: OptimizedCV["sections"][number]["items"][number];
  d: AtsDensity;
  isLast: boolean;
}) {
  // Une puce ou un tag vide (champ jamais rempli, ou vidé par l'utilisateur) ne
  // doit jamais atteindre le PDF : il sortirait comme un marqueur orphelin ou
  // une virgule isolée dans la liste inline.
  const bullets = item.bullets.filter((b) => b.trim().length > 0);
  const tags = item.tags.filter((t) => t.trim().length > 0);

  // Catégorie de compétences : « Label : a, b, c » sur une seule ligne de texte.
  // Un parseur lit un flux continu — bien plus fiable que des pastilles.
  const isSkillCategory = tags.length > 0 && bullets.length === 0;

  if (isSkillCategory) {
    return (
      <Text
        style={{
          fontSize: d.bodyFs,
          lineHeight: d.lineHeight,
          color: BLACK,
          marginBottom: isLast ? 0 : d.compactItemGap,
        }}
      >
        {item.heading ? (
          <Text style={{ fontWeight: 700 }}>{item.heading} : </Text>
        ) : null}
        {tags.join(", ")}
      </Text>
    );
  }

  const hasHeadingRow = !!(item.heading || item.company || item.subheading);
  // Une ligne simple (formation, langue) se serre ; un bloc à puces respire.
  const gap = bullets.length > 0 ? d.itemGap : d.compactItemGap;

  return (
    <View style={{ marginBottom: isLast ? 0 : gap }} wrap={false}>
      {hasHeadingRow ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Text
            style={{
              fontSize: d.bodyFs,
              lineHeight: d.lineHeight,
              color: BLACK,
              flex: 1,
              paddingRight: 10,
            }}
          >
            {item.heading ? (
              <Text style={{ fontWeight: 700 }}>
                {item.heading}
                {item.company ? "," : ""}
              </Text>
            ) : null}
            {item.company ? `${item.heading ? " " : ""}${item.company}` : ""}
          </Text>
          {item.subheading ? (
            <Text
              style={{
                fontSize: d.bodyFs,
                lineHeight: d.lineHeight,
                color: BLACK,
                flexShrink: 0,
                textAlign: "right",
              }}
            >
              {item.subheading}
            </Text>
          ) : null}
        </View>
      ) : null}

      {bullets.length > 0 ? (
        <View style={{ marginTop: hasHeadingRow ? 1.5 : 0 }}>
          {bullets.map((bullet, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", marginBottom: d.bulletMb, paddingLeft: 10 }}
            >
              <Text
                style={{
                  fontSize: d.bodyFs,
                  lineHeight: d.lineHeight,
                  color: BLACK,
                  width: 10,
                  flexShrink: 0,
                }}
              >
                •
              </Text>
              <Text
                style={{
                  fontSize: d.bodyFs,
                  lineHeight: d.lineHeight,
                  color: BLACK,
                  flex: 1,
                }}
              >
                {bullet}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Un item avec des tags ET des bullets : les tags ferment l'item, inline. */}
      {tags.length > 0 && bullets.length > 0 ? (
        <Text
          style={{
            fontSize: d.bodyFs,
            lineHeight: d.lineHeight,
            color: BLACK,
            paddingLeft: 10,
            marginTop: 1,
          }}
        >
          {tags.join(", ")}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function AtsSection({
  section,
  d,
}: {
  section: OptimizedCV["sections"][number];
  d: AtsDensity;
}) {
  const items = section.items.filter(
    (it) =>
      it.heading?.trim() ||
      it.subheading?.trim() ||
      it.bullets.length > 0 ||
      it.tags.length > 0
  );
  if (items.length === 0) return null;

  return (
    <View style={{ marginBottom: d.sectionGap }}>
      <AtsSectionTitle label={section.title} d={d} />
      {items.map((item, i) => (
        <AtsItem key={i} item={item} d={d} isLast={i === items.length - 1} />
      ))}
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AtsPage({ cv, density }: { cv: OptimizedCV; density: number }) {
  const d = ATS_DENSITIES[Math.max(0, Math.min(ATS_DENSITIES.length - 1, density))];

  return (
    <Page
      size="A4"
      style={{
        fontFamily: "Inter",
        fontSize: d.bodyFs,
        lineHeight: d.lineHeight,
        color: BLACK,
        backgroundColor: "#ffffff",
        paddingTop: d.padY,
        paddingBottom: d.padY,
        paddingLeft: d.padX,
        paddingRight: d.padX,
      }}
    >
      <AtsHeader cv={cv} d={d} />

      {cv.accroche?.trim() ? (
        <View style={{ marginBottom: d.sectionGap }}>
          <AtsSectionTitle label="Profil" d={d} />
          <Text style={{ fontSize: d.bodyFs, lineHeight: d.lineHeight, color: BLACK }}>
            {cv.accroche.trim()}
          </Text>
        </View>
      ) : null}

      {cv.sections.map((section, i) => (
        <AtsSection key={i} section={section} d={d} />
      ))}
    </Page>
  );
}
