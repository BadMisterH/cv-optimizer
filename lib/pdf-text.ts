import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extrait le texte brut d'un PDF côté serveur, de façon déterministe (pas d'IA).
 * Sert de vérité terrain pour vérifier que la fiche vérité extraite par le modèle
 * ne contient pas de faits hallucinés (ex : une techno "plausible" jamais écrite
 * dans le CV). Retourne une chaîne vide si le PDF n'a pas de couche texte
 * (scan/image) ou si le parsing échoue — l'appelant doit alors SAUTER la
 * vérification plutôt que de tout rejeter.
 */
export async function extractPdfText(buffer: Buffer | Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return typeof text === "string" ? text : "";
  } catch (err) {
    console.warn("[pdf-text] extraction de texte impossible, vérification sautée:", err);
    return "";
  }
}
