# Smoke test pré-vente — liste d'attente sur /buy-credits

**Date:** 2026-06-22
**Statut:** Approuvé

---

## Contexte

`STRIPE_ENABLED` vient d'être remis à `true` (revert Paddle → Stripe). Mais le compte Stripe n'est probablement pas encore activé pour les paiements en live : si on déploie tel quel, le bouton "Acheter" est actif côté client et déclenche une vraie tentative de Checkout qui peut échouer côté Stripe ("cannot currently make live charges"), exposant l'échec à un utilisateur déjà engagé à payer.

**Objectif :** valider la demande réelle avant d'activer les paiements. `/buy-credits` (déjà la page de vente de facto — liée depuis la section `#tarifs` de la landing) affiche les vrais prix, mais le clic sur "Acheter" capture l'intérêt (email + pack) au lieu de lancer un Checkout. Une fois 3 à 5 leads chauds obtenus, le site owner les recontacte manuellement, puis bascule un flag pour activer Stripe en vrai — sans autre changement de code.

---

## Décision clé : un seul flag pilote les deux modes

`STRIPE_ENABLED` repasse à `false` maintenant. Ce même flag devient le switch entre les deux modes de `/buy-credits` :

- `false` → mode liste d'attente (ce qu'on construit)
- `true` → Checkout Stripe réel (code déjà existant, intact, simplement inatteignable tant que le flag est `false`)

Passer en "Stripe live" plus tard = un seul changement de valeur dans `lib/feature-flags.ts`.

---

## Données

Nouvelle table `waitlist_signups`, créée via un script de migration ponctuel (même pattern que `scripts/migrate-account-table.mjs`) :

```sql
CREATE TABLE IF NOT EXISTS "waitlist_signups" (
  "id"         SERIAL PRIMARY KEY,
  "email"      TEXT NOT NULL,
  "pack"       TEXT NOT NULL,
  "user_id"    TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE ("email", "pack")
);
```

`UNIQUE (email, pack)` rend l'inscription idempotente : un même lead qui re-clique sur le même pack n'insère pas de doublon (`ON CONFLICT DO NOTHING`), et l'UI affiche quand même l'état succès.

---

## API : `POST /api/waitlist`

- Rate-limitée via `lib/rate-limit.ts` (5 req / 10 min / IP) pour limiter le spam.
- Résolution de l'email :
  - Session active (`auth.api.getSession`) → email du compte utilisé, le body est ignoré pour ce champ.
  - Pas de session → `email` requis dans le body, validé par une regex simple. 400 si absent/invalide.
- `pack` validé via `isPackKey` (déjà exporté par `lib/stripe-packs.ts`).
- Insert `ON CONFLICT (email, pack) DO NOTHING` ; succès retourné dans tous les cas (insert réel ou conflit).
- Notification admin best-effort, non bloquante (catch + log, même pattern que l'email de bienvenue dans `lib/auth.ts`) : email à `badraitoufel5@gmail.com` via Resend, avec l'email du lead, le pack, et le total actuel de la table (`SELECT COUNT(*)`).
- Réponse : `{ ok: true }` (200) ou `{ error: string }` (400/429/500).

### Refactor associé

`sendEmail` et `buildEmailHtml` sont extraits de `lib/auth.ts` vers un nouveau `lib/email.ts` (comportement identique, juste déplacé pour être réutilisable hors du module auth). `lib/auth.ts` importe ces deux fonctions depuis `lib/email.ts` au lieu de les définir localement.

---

## UI — `/buy-credits`

Le bandeau actuel ("Paiement par carte bientôt disponible") devient :

```
● Bêta — places limitées
On ouvre les paiements dès qu'on a assez de monde dessus.
Dis-nous que tu es chaud, on te recontacte en priorité.
```

Chaque carte de pack a un état local (`idle` / `loading` / `done`) :

- **Connecté** : clic sur "Je veux l'acheter" → `POST /api/waitlist { pack }` direct (email pris en session) → bouton devient `✓ Tu es sur la liste` (désactivé, style succès) + note sous la carte : *"On te recontacte dès l'ouverture."*
- **Anonyme** : clic → un champ email apparaît sous la carte (inline, pas de modale) + bouton "Confirmer". Email invalide → message inline, pas de requête. Soumission → même flux que connecté.
- Le flux Stripe existant (`handleBuy`, vue succès post-paiement, etc.) reste inchangé dans le code, simplement non atteint tant que `STRIPE_ENABLED=false`.

Footer "Paiement sécurisé par Stripe..." masqué en mode liste d'attente, remplacé par : *"● On t'écrit par email dès l'ouverture des paiements."*

---

## Erreurs

| Cas | Comportement |
|---|---|
| Rate limit dépassé | Message inline "Trop de tentatives, réessaie dans quelques minutes." |
| Email invalide (anonyme) | Validation côté client, pas de requête envoyée |
| Échec insert DB | Message générique "Une erreur est survenue, réessaie." |
| Échec email notif admin | Jamais bloquant pour l'utilisateur ; lead déjà en base, juste loggé côté serveur |
| Doublon (déjà inscrit sur ce pack) | Traité comme un succès, état `done` affiché |

Pas de page d'admin pour lister les leads (hors scope — l'email de notif suffit pour 3 à 5 signups ; la table reste interrogeable en SQL direct si besoin).

---

## Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `scripts/migrate-waitlist-table.mjs` | Créé — migration ponctuelle de la table |
| `lib/email.ts` | Créé — `sendEmail` + `buildEmailHtml` extraits de `lib/auth.ts` |
| `lib/auth.ts` | Modifié — import depuis `lib/email.ts` au lieu de définitions locales |
| `app/api/waitlist/route.ts` | Créé — route POST décrite ci-dessus |
| `app/buy-credits/page.tsx` | Modifié — nouvel état liste d'attente par pack, bandeau/footer copy |
| `lib/feature-flags.ts` | Modifié — `STRIPE_ENABLED` repasse à `false` |

---

## Test plan

1. `npx tsc --noEmit` — compile propre.
2. Lancer `scripts/migrate-waitlist-table.mjs` en local (`node --env-file=.env.local scripts/migrate-waitlist-table.mjs`) pour créer la table.
3. `npm run dev`, tester sur `/buy-credits` :
   - Connecté : clic "Je veux l'acheter" sur un pack → état succès, vérifier la ligne en base et l'email de notif (log console si `RESEND_API_KEY` absent en local).
   - Anonyme : clic → champ email apparaît, email invalide bloqué, email valide → succès.
   - Re-clic sur le même pack (déjà inscrit) → succès affiché, pas de doublon en base.
4. Vérifier que le bandeau/footer/copy reflètent bien le mode liste d'attente.
