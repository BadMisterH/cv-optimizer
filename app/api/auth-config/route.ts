import { NextResponse } from "next/server";
import { config } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ googleEnabled: config.googleEnabled });
}
