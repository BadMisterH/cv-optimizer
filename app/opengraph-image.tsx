import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CV Optimizer · Ton CV est peut-être bon, mais pas pour cette offre";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Image Open Graph générée dynamiquement (1200x630).
 * Affichée quand le site est partagé sur LinkedIn, Twitter, WhatsApp, etc.
 *
 * DA Swiss éditoriale : crème + ink + accent bleu, typographie display + mono.
 */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#fbfaf6",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#0f0f10",
          position: "relative",
        }}
      >
        {/* Bandeau accent en haut */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: "#1f4bff",
          }}
        />

        {/* Eyebrow mono */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#5d5b56",
            marginTop: 16,
          }}
        >
          <span style={{ color: "#d97247" }}>● CV CIBLÉ PAR OFFRE</span>
          <span style={{ color: "#1f4bff" }}>● SANS MENSONGE</span>
          <span style={{ color: "#1a8a5a" }}>● PDF PRÊT À ENVOYER</span>
        </div>

        {/* Title block */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: -2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Ton CV est peut-être bon.</span>
            <span>
              Mais{" "}
              <span style={{ fontStyle: "italic", color: "#1f4bff", fontWeight: 400 }}>
                pas
              </span>{" "}
              pour cette offre.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#0f0f10",
            fontWeight: 600,
          }}
        >
          <span>CV Optimizer</span>
          <span style={{ color: "#5d5b56", fontWeight: 400, fontSize: 18 }}>
            cv-optimizer.fr
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
