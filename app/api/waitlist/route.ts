import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isPackKey, PACKS } from "@/lib/stripe-packs";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail, buildEmailHtml } from "@/lib/email";
import { ADMIN_EMAILS } from "@/lib/admin";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function notifyAdmin(email: string, pack: string) {
  const { rows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM "waitlist_signups"'
  );
  const total = rows[0]?.count ?? "?";
  const label = PACKS[pack as keyof typeof PACKS].label;
  const price = PACKS[pack as keyof typeof PACKS].price;

  for (const adminEmail of ADMIN_EMAILS) {
    await sendEmail({
      to: adminEmail,
      subject: `Nouveau lead — pack ${label} (${total} au total)`,
      fallbackLabel: "WAITLIST NOTIFY",
      html: buildEmailHtml({
        title: "Nouveau lead sur la liste d'attente",
        intro: `${email} veut acheter le pack ${label} (${price}). Total liste d'attente : ${total} inscrit(s).`,
        ctaLabel: "Voir la page de vente",
        url: "https://cv-optimizer.fr/buy-credits",
        footer: "Notification automatique — liste d'attente /buy-credits.",
      }),
    });
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`waitlist:${ip}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives, réessaie dans quelques minutes." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const packKey = body?.pack;
  if (typeof packKey !== "string" || !isPackKey(packKey)) {
    return NextResponse.json({ error: "Pack invalide." }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  let email: string;
  let userId: string | null = null;

  if (session?.user) {
    email = session.user.email.toLowerCase();
    userId = session.user.id;
  } else {
    const bodyEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(bodyEmail)) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    email = bodyEmail;
  }

  try {
    await pool.query(
      `INSERT INTO "waitlist_signups" (email, pack, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (email, pack) DO NOTHING`,
      [email, packKey, userId]
    );
  } catch (err) {
    console.error("[api/waitlist] insert failed:", err);
    return NextResponse.json(
      { error: "Une erreur est survenue, réessaie." },
      { status: 500 }
    );
  }

  notifyAdmin(email, packKey).catch((err) =>
    console.error("[api/waitlist] admin notify failed:", err)
  );

  return NextResponse.json({ ok: true });
}
