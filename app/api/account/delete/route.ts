import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const userId = session.user.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Suppression explicite des tables liées (cascade-safe même si les FK ne sont pas en cascade)
    await client.query('DELETE FROM session WHERE "userId" = $1', [userId]);
    await client.query('DELETE FROM account WHERE "userId" = $1', [userId]);
    await client.query("DELETE FROM purchases WHERE user_id = $1", [userId]);
    await client.query('DELETE FROM "user" WHERE id = $1', [userId]);
    // NB : la ligne dans consumed_signup_bonuses N'EST PAS supprimée (trace anti-fraude).
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[api/account/delete] échec suppression:", err);
    return NextResponse.json(
      { error: "Échec de la suppression. Réessaie plus tard." },
      { status: 500 }
    );
  } finally {
    client.release();
  }

  // Force la déconnexion : on clear les cookies de session better-auth.
  // Les noms peuvent varier (session_token vs better-auth.session_token selon la version).
  const res = NextResponse.json({ success: true });
  for (const cookieName of [
    "better-auth.session_token",
    "better-auth.session_data",
    "__Secure-better-auth.session_token",
  ]) {
    res.cookies.set(cookieName, "", {
      path: "/",
      expires: new Date(0),
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
