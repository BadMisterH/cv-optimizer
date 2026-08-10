import "server-only";
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Link,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { OptimizedCV } from "@/app/types";
import {
  COLORS,
  buildContactItems,
  type CVPdfOptions,
  type Template,
} from "./cv-pdf-shared";
import { AtsPage } from "./cv-pdf-ats";

// L'enregistrement de la police Inter et les helpers de contact vivent dans
// ./cv-pdf-shared, partagés avec le template ATS (./cv-pdf-ats).
export type { Template, CVPdfOptions };

// ─── Densité ──────────────────────────────────────────────────────────────────

interface DensityConfig {
  baseFontSize: number;
  lineHeight: number;
  sectionGap: number;
  sectionTitleMb: number;
  sectionTitleFs: number;
  itemGap: number;
  itemBulletsLh: number;
  itemBulletsMb: number;
  containerPadY: number;
  containerPadX: number;
  headerMb: number;
  titleFontSize: number;
  subtitleFontSize: number;
  photoW: number;
  photoH: number;
  tagFontSize: number;
  tagPadH: number;
  tagPadV: number;
}

// Niveaux 2-4 : lineHeight/itemBulletsLh et containerPadY ont un plancher
// (1.30 / 7) qu'on ne descend plus jamais — la compaction supplémentaire aux
// niveaux élevés vient des espaces entre blocs (sectionGap, itemGap, headerMb,
// sectionTitleMb) et de pastilles de compétences plus resserrées (tagPadH/V),
// pas de l'interligne ni des marges de page qui donnaient l'effet "écrasé".
const DENSITIES: DensityConfig[] = [
  // 0 — spacieux
  { baseFontSize: 10.5, lineHeight: 1.45, sectionGap: 10, sectionTitleMb: 6, sectionTitleFs: 8, itemGap: 7, itemBulletsLh: 1.38, itemBulletsMb: 1.5, containerPadY: 14, containerPadX: 22, headerMb: 10, titleFontSize: 20, subtitleFontSize: 13, photoW: 74, photoH: 92, tagFontSize: 8.2, tagPadH: 7, tagPadV: 2.5 },
  // 1
  { baseFontSize: 10.3, lineHeight: 1.42, sectionGap: 8, sectionTitleMb: 5, sectionTitleFs: 8, itemGap: 6, itemBulletsLh: 1.33, itemBulletsMb: 1, containerPadY: 11, containerPadX: 22, headerMb: 8, titleFontSize: 19, subtitleFontSize: 12.5, photoW: 70, photoH: 86, tagFontSize: 8, tagPadH: 6, tagPadV: 2 },
  // 2
  { baseFontSize: 10, lineHeight: 1.38, sectionGap: 5.5, sectionTitleMb: 3.5, sectionTitleFs: 7.9, itemGap: 4.5, itemBulletsLh: 1.30, itemBulletsMb: 0.5, containerPadY: 9, containerPadX: 22, headerMb: 6, titleFontSize: 18, subtitleFontSize: 12, photoW: 66, photoH: 80, tagFontSize: 7.8, tagPadH: 5.5, tagPadV: 1.8 },
  // 3
  { baseFontSize: 9.7, lineHeight: 1.33, sectionGap: 4.5, sectionTitleMb: 2.5, sectionTitleFs: 7.8, itemGap: 3.5, itemBulletsLh: 1.30, itemBulletsMb: 0, containerPadY: 7.5, containerPadX: 20, headerMb: 4, titleFontSize: 17, subtitleFontSize: 11.5, photoW: 60, photoH: 74, tagFontSize: 7.6, tagPadH: 5, tagPadV: 1.4 },
  // 4 — compact
  { baseFontSize: 9.3, lineHeight: 1.30, sectionGap: 3.5, sectionTitleMb: 2, sectionTitleFs: 7.6, itemGap: 2.5, itemBulletsLh: 1.30, itemBulletsMb: 0, containerPadY: 7, containerPadX: 18, headerMb: 3, titleFontSize: 16, subtitleFontSize: 11, photoW: 56, photoH: 68, tagFontSize: 7.4, tagPadH: 4.5, tagPadV: 1.2 },
];

// ─── CVHeader ─────────────────────────────────────────────────────────────────

interface CVHeaderProps {
  cv: OptimizedCV;
  photo: string | undefined;
  accent: string;
  d: DensityConfig;
  template: Template;
}

function CVHeader({ cv, photo, accent, d, template }: CVHeaderProps) {
  const contactItems = buildContactItems(cv.contact);
  const isSingle = template === "single";

  const photoEl = photo ? (
    <Image
      src={photo}
      style={{
        width: d.photoW,
        height: d.photoH,
        objectFit: "cover",
        borderRadius: 1,
        flexShrink: 0,
      }}
    />
  ) : null;

  const contactRow = contactItems.length > 0 ? (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 7 }}>
      {contactItems.map((item, i) => (
        <View key={i} style={{ flexDirection: "row" }}>
          {i > 0 && (
            <Text style={{ fontSize: 8.5, color: COLORS.inkFaint }}>{" · "}</Text>
          )}
          {item.kind === "link" ? (
            <Link
              src={item.href}
              style={{ fontSize: 8.5, color: COLORS.inkSoft, textDecoration: "none" }}
            >
              {item.label}
            </Link>
          ) : (
            <Text style={{ fontSize: 8.5, color: COLORS.inkMuted }}>{item.label}</Text>
          )}
        </View>
      ))}
    </View>
  ) : null;

  return (
    <View
      style={{
        marginBottom: d.headerMb,
        borderBottomWidth: 1.5,
        borderBottomColor: COLORS.ink,
        paddingBottom: 8,
      }}
    >
      {/* Trait accent */}
      <View style={{ width: 28, height: 1.4, backgroundColor: accent, marginBottom: 5 }} />

      {isSingle ? (
        <View style={{ alignItems: "center" }}>
          {photoEl ? <View style={{ marginBottom: 6 }}>{photoEl}</View> : null}
          <Text
            style={{
              fontSize: d.titleFontSize,
              fontFamily: "Inter",
              fontWeight: 700,
              letterSpacing: -0.7,
              color: COLORS.ink,
              lineHeight: 1,
              marginBottom: 5,
              textAlign: "center",
            }}
          >
            {cv.fullName}
          </Text>
          {cv.title ? (
            <Text
              style={{
                fontSize: d.subtitleFontSize,
                color: accent,
                marginTop: 2,
                textTransform: "uppercase",
                letterSpacing: 1,
                textAlign: "center",
              }}
            >
              {cv.title}
            </Text>
          ) : null}
          {contactRow}
        </View>
      ) : (
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: d.titleFontSize,
                  fontFamily: "Inter",
                  fontWeight: 700,
                  letterSpacing: -0.7,
                  color: COLORS.ink,
                  lineHeight: 1,
                  marginBottom: 5,
                }}
              >
                {cv.fullName}
              </Text>
              {cv.title ? (
                <Text
                  style={{
                    fontSize: d.subtitleFontSize,
                    color: accent,
                    marginTop: 2,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {cv.title}
                </Text>
              ) : null}
            </View>
            {photoEl}
          </View>
          {contactRow}
        </View>
      )}
    </View>
  );
}

// ─── CVAccroche ───────────────────────────────────────────────────────────────

function CVAccroche({ text, accent, d }: { text: string; accent: string; d: DensityConfig }) {
  return (
    <View style={{ marginBottom: d.sectionGap }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 0.5,
          borderBottomColor: COLORS.rule,
          paddingBottom: 5,
          marginBottom: d.sectionTitleMb,
        }}
      >
        <View style={{ width: 5, height: 5, backgroundColor: accent, marginRight: 7, flexShrink: 0 }} />
        <Text
          style={{
            fontSize: d.sectionTitleFs,
            fontFamily: "Inter",
            fontWeight: 700,
            textTransform: "uppercase",
            color: COLORS.ink,
          }}
        >
          Profil
        </Text>
      </View>
      <Text
        style={{
          fontSize: 9.5,
          color: COLORS.inkSoft,
          lineHeight: 1.45,
          paddingLeft: 10,
          borderLeftWidth: 1.2,
          borderLeftColor: accent,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// ─── CVItem ───────────────────────────────────────────────────────────────────

interface CVItemProps {
  item: OptimizedCV["sections"][number]["items"][number];
  accent: string;
  d: DensityConfig;
}

function CVItem({ item, accent, d }: CVItemProps) {
  const isSkillCat = item.tags.length > 0 && item.bullets.length === 0 && !!item.heading;

  return (
    <View style={{ marginBottom: d.itemGap }}>
      {item.heading ? (
        isSkillCat ? (
          <View style={{ marginBottom: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
              <Text
                style={{
                  fontSize: 8.5,
                  fontFamily: "Inter",
                  fontWeight: 700,
                  color: COLORS.ink,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginRight: 8,
                }}
              >
                {item.heading}
              </Text>
              <View style={{ flex: 1, height: 0.4, backgroundColor: COLORS.rule }} />
            </View>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "baseline", flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: d.baseFontSize,
                  fontFamily: "Inter",
                  fontWeight: 700,
                  color: COLORS.ink,
                  letterSpacing: -0.15,
                }}
              >
                {item.heading}
              </Text>
              {item.company ? (
                <Text
                  style={{
                    fontSize: d.baseFontSize,
                    fontFamily: "Inter",
                    fontWeight: 700,
                    color: accent,
                    marginLeft: 5,
                  }}
                >
                  {" · "}
                  {item.company}
                </Text>
              ) : null}
            </View>
            {item.subheading ? (
              <Text
                style={{
                  fontSize: 8.3,
                  color: COLORS.inkMuted,
                  textAlign: "right",
                  flexShrink: 0,
                  marginLeft: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.2,
                }}
              >
                {item.subheading}
              </Text>
            ) : null}
          </View>
        )
      ) : null}

      {/* Bullets */}
      {item.bullets.length > 0 ? (
        <View style={{ marginTop: 2, paddingLeft: 12 }}>
          {item.bullets.map((b, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                marginBottom: d.itemBulletsMb,
              }}
            >
              <View
                style={{
                  width: 3.5,
                  height: 3.5,
                  backgroundColor: accent,
                  borderRadius: 0.5,
                  marginTop: 3,
                  marginRight: 4,
                  marginLeft: -9,
                  flexShrink: 0,
                }}
              />
              <Text
                style={{
                  fontSize: d.baseFontSize * 0.9,
                  color: COLORS.inkSoft,
                  lineHeight: d.itemBulletsLh,
                  flex: 1,
                }}
              >
                {b}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Tags */}
      {item.tags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3 }}>
          {item.tags.map((tag, i) => (
            <View
              key={i}
              style={{
                borderWidth: 0.5,
                borderColor: accent,
                borderRadius: 999,
                paddingHorizontal: d.tagPadH,
                paddingVertical: d.tagPadV,
                marginRight: 4,
                marginBottom: 3,
              }}
            >
              <Text style={{ fontSize: d.tagFontSize, color: COLORS.inkSoft, letterSpacing: 0.15 }}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── CVSection ────────────────────────────────────────────────────────────────

interface CVSectionProps {
  section: OptimizedCV["sections"][number];
  accent: string;
  d: DensityConfig;
}

function CVSection({ section, accent, d }: CVSectionProps) {
  const visibleItems = section.items.filter(
    (it) =>
      it.heading?.trim() ||
      it.subheading?.trim() ||
      it.bullets.length > 0 ||
      it.tags.length > 0
  );
  if (visibleItems.length === 0) return null;

  return (
    <View style={{ marginBottom: d.sectionGap }} wrap={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 0.5,
          borderBottomColor: COLORS.rule,
          paddingBottom: 5,
          marginBottom: d.sectionTitleMb,
        }}
      >
        <View style={{ width: 5, height: 5, backgroundColor: accent, marginRight: 7, flexShrink: 0 }} />
        <Text
          style={{
            fontSize: d.sectionTitleFs,
            fontFamily: "Inter",
            fontWeight: 700,
            textTransform: "uppercase",
            color: COLORS.ink,
          }}
        >
          {section.title}
        </Text>
      </View>
      {visibleItems.map((item, i) => (
        <CVItem key={i} item={item} accent={accent} d={d} />
      ))}
    </View>
  );
}

// ─── CVDocument ───────────────────────────────────────────────────────────────

interface CVDocumentProps {
  cv: OptimizedCV;
  photo: string | undefined;
  accentColor: string;
  template: Template;
  density: number;
}

function CVDocument({ cv, photo, accentColor, template, density }: CVDocumentProps) {
  // Le template ATS a sa propre page : pas de photo, pas de couleur d'accent,
  // pas de pastilles — sa mise en page ne partage rien avec classic/single.
  if (template === "ats") {
    return (
      <Document>
        <AtsPage cv={cv} density={density} />
      </Document>
    );
  }

  const d = DENSITIES[Math.max(0, Math.min(4, density))];
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(accentColor) ? accentColor : "#1f4bff";

  return (
    <Document>
      <Page
        size="A4"
        style={{
          fontFamily: "Inter",
          fontSize: d.baseFontSize,
          lineHeight: d.lineHeight,
          color: COLORS.ink,
          backgroundColor: "#ffffff",
          paddingTop: d.containerPadY,
          paddingBottom: d.containerPadY,
          paddingLeft: d.containerPadX,
          paddingRight: d.containerPadX,
        }}
      >
        <CVHeader cv={cv} photo={photo} accent={accent} d={d} template={template} />

        {cv.accroche?.trim() ? (
          <CVAccroche text={cv.accroche.trim()} accent={accent} d={d} />
        ) : null}

        {cv.sections.map((section, i) => (
          <CVSection key={i} section={section} accent={accent} d={d} />
        ))}
      </Page>
    </Document>
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────

export async function renderCVToBuffer(
  cv: OptimizedCV,
  options: CVPdfOptions = {}
): Promise<Buffer> {
  const {
    photo,
    accentColor = "#1f4bff",
    template = "classic",
    density = 0,
  } = options;

  const buf = await renderToBuffer(
    <CVDocument
      cv={cv}
      photo={photo}
      accentColor={accentColor}
      template={template}
      density={density}
    />
  );
  return buf;
}
