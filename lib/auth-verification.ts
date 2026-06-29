import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type SessionUserWithVerification = {
  emailVerified?: boolean | null;
};

export function isEmailVerified(user: SessionUserWithVerification | null | undefined) {
  return user?.emailVerified === true;
}

export function emailVerificationRequiredResponse() {
  return NextResponse.json(
    {
      error: "Vérifie ton adresse email avant de continuer.",
      code: "EMAIL_NOT_VERIFIED",
      redirect: "/sign-in?verify=email",
    },
    { status: 403 }
  );
}

export async function requireVerifiedSession(req: Request) {
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

  if (!isEmailVerified(session.user)) {
    return {
      session: null,
      response: emailVerificationRequiredResponse(),
    };
  }

  return { session, response: null };
}
