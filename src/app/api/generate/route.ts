/**
 * POST /api/generate
 * Accepts JSON: { prompt, imageBase64, model, aspectRatio, durationSec, seed? }
 * Returns: { jobId }
 * Runs Fal.ai generation async, pushes updates via SSE.
 */
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { jobStore }   from "@/lib/jobStore";
import { runFal, falConfigured } from "@/lib/fal";
import { GenerateRequest, Job } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!falConfigured()) {
      return NextResponse.json(
        { error: "FAL_API_KEY is not configured. Add it to your environment variables." },
        { status: 503 }
      );
    }

    const body = await req.json() as GenerateRequest;

    if (!body.prompt?.trim())      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    if (!body.imageBase64?.trim()) return NextResponse.json({ error: "Image is required." },  { status: 400 });
    if (!body.durationSec || body.durationSec < 3 || body.durationSec > 10)
      return NextResponse.json({ error: "Duration must be 3–10s (Fal.ai free tier limit)." }, { status: 400 });

    const id = uuid();
    const now = Date.now();

    const job: Job = {
      id,
      status:      "queued",
      prompt:      body.prompt.trim(),
      model:       body.model      ?? "wan",
      aspectRatio: body.aspectRatio ?? "16:9",
      durationSec: body.durationSec,
      progress:    0,
      logs:        ["Job queued…"],
      createdAt:   now,
      updatedAt:   now,
    };
    jobStore.set(job);

    // Run async — do NOT await
    runGeneration(id, body).catch(err => {
      console.error(`[Job ${id}] fatal:`, err);
      jobStore.update(id, { status: "error", error: String(err) });
    });

    return NextResponse.json({ jobId: id }, { status: 202 });
  } catch (err) {
    console.error("[/api/generate]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runGeneration(jobId: string, req: GenerateRequest): Promise<void> {
  jobStore.update(jobId, { status: "uploading", progress: 5, logs: ["Sending image to Fal.ai…"] });

  const result = await runFal(
    {
      imageDataUrl: req.imageBase64,
      prompt:       req.prompt,
      model:        req.model      ?? "wan",
      aspectRatio:  req.aspectRatio ?? "16:9",
      durationSec:  req.durationSec,
      seed:         req.seed,
    },
    (msg)  => { const j = jobStore.get(jobId); jobStore.update(jobId, { logs: [...(j?.logs ?? []), msg] }); },
    (pct)  => jobStore.update(jobId, { status: "generating", progress: pct }),
  );

  jobStore.update(jobId, {
    status:   "done",
    progress: 100,
    videoUrl: result.videoUrl,
  });
}
