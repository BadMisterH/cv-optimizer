import { NextResponse } from "next/server";
import { auth } from "./auth";

export async function requireSession(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Authentification requise.", code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }
  return { session, response: null };
}
