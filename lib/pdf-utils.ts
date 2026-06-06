/**
 * Compte le nombre de pages dans un buffer PDF en cherchant
 * les entrées /Type /Page (mais pas /Pages qui est le parent).
 * Fonctionne sans dépendance : regex sur le contenu latin1 du buffer.
 */
export function countPdfPages(buf: Buffer): number {
  const text = buf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}
