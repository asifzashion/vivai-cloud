/**
 * GET /api/check-key
 * Returns whether the FAL_API_KEY is configured.
 */
import { NextResponse } from "next/server";
import { falConfigured } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ configured: falConfigured() });
}
