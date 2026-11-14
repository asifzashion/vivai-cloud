/**
 * GET  /api/gallery  → list completed jobs
 * DELETE /api/gallery?jobId=xxx → remove a job
 */
import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const items = jobStore.getAll()
    .filter(j => j.status === "done" && j.videoUrl)
    .map(j => ({
      id:          j.id,
      videoUrl:    j.videoUrl,
      prompt:      j.prompt,
      model:       j.model,
      aspectRatio: j.aspectRatio,
      durationSec: j.durationSec,
      createdAt:   j.createdAt,
    }));
  return NextResponse.json({ items });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  jobStore.delete(jobId);
  return NextResponse.json({ ok: true });
}
