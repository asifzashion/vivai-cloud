/**
 * Fal.ai inference client.
 * Supports: Wan 2.2 I2V, LTX-Video 2.5, MiniMax Video
 * All prompts passed verbatim — zero filtering.
 */

import { FalModel, AspectRatio } from "@/types";

const FAL_KEY = process.env.FAL_API_KEY ?? "";

// ── Model endpoint map ────────────────────────────────────────────────────────
const MODEL_ENDPOINTS: Record<FalModel, string> = {
  wan:     "fal-ai/wan/v2.2/1.3b/image-to-video",
  ltx:     "fal-ai/ltx-video/image-to-video",
  minimax: "fal-ai/minimax/video-01/image-to-video",
};

function dims(ar: AspectRatio): { width: number; height: number } {
  if (ar === "9:16") return { width: 576,  height: 1024 };
  if (ar === "1:1")  return { width: 768,  height: 768  };
  return               { width: 1280, height: 720  };
}

export interface FalInput {
  imageDataUrl: string;    // data:image/...;base64,...
  prompt:       string;
  model:        FalModel;
  aspectRatio:  AspectRatio;
  durationSec:  number;
  seed?:        number;
}

export interface FalResult {
  videoUrl:   string;
  requestId:  string;
}

type LogCallback = (msg: string) => void;
type ProgressCallback = (pct: number) => void;

// ── Main submit + poll ────────────────────────────────────────────────────────
export async function runFal(
  input: FalInput,
  onLog?: LogCallback,
  onProgress?: ProgressCallback,
): Promise<FalResult> {
  if (!FAL_KEY) throw new Error("FAL_API_KEY is not set in environment variables.");

  const endpoint = MODEL_ENDPOINTS[input.model];
  const { width, height } = dims(input.aspectRatio);

  // Build model-specific payload
  const payload = buildPayload(input, width, height);

  onLog?.(`Submitting to fal.ai · model: ${input.model}`);
  onProgress?.(5);

  // ── 1. Submit ──────────────────────────────────────────────────────────────
  const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (submitRes.status === 401) throw new Error("FAL_401: Invalid API key — check FAL_API_KEY in settings.");
  if (submitRes.status === 402) throw new Error("FAL_402: Fal.ai account out of credits.");
  if (submitRes.status === 429) throw new Error("FAL_429: Rate limited — try again in a moment.");
  if (!submitRes.ok) {
    const txt = await submitRes.text();
    throw new Error(`Fal.ai submit error ${submitRes.status}: ${txt}`);
  }

  const { request_id } = await submitRes.json() as { request_id: string };
  onLog?.(`Job queued · request_id: ${request_id}`);
  onProgress?.(10);

  // ── 2. Poll status ─────────────────────────────────────────────────────────
  const statusUrl  = `https://queue.fal.run/${endpoint}/requests/${request_id}/status`;
  const resultUrl  = `https://queue.fal.run/${endpoint}/requests/${request_id}`;
  const deadline   = Date.now() + 12 * 60_000; // 12 min timeout
  let   lastStatus = "";
  let   pollPct    = 15;

  while (true) {
    if (Date.now() > deadline) throw new Error("Fal.ai timeout — generation took too long.");
    await sleep(3000);

    const sRes = await fetch(statusUrl, {
      headers: { "Authorization": `Key ${FAL_KEY}` },
    });
    if (!sRes.ok) continue;

    const sData = await sRes.json() as {
      status: string;
      logs?: Array<{ message: string }>;
      queue_position?: number;
    };

    if (sData.status !== lastStatus) {
      onLog?.(`Status: ${sData.status}${sData.queue_position ? ` (queue pos: ${sData.queue_position})` : ""}`);
      lastStatus = sData.status;
    }

    // Forward fal logs
    if (sData.logs?.length) {
      sData.logs.forEach(l => onLog?.(l.message));
    }

    // Advance fake progress
    if (pollPct < 90) { pollPct += 4; onProgress?.(pollPct); }

    if (sData.status === "COMPLETED") {
      onProgress?.(95);
      onLog?.("Generation complete — fetching result…");
      break;
    }
    if (sData.status === "FAILED") {
      throw new Error("Fal.ai generation failed.");
    }
  }

  // ── 3. Fetch result ────────────────────────────────────────────────────────
  const rRes = await fetch(resultUrl, {
    headers: { "Authorization": `Key ${FAL_KEY}` },
  });
  if (!rRes.ok) throw new Error(`Failed to fetch result: ${rRes.status}`);

  const result = await rRes.json() as {
    video?: { url: string };
    output?: { url: string } | string;
  };

  const videoUrl =
    result.video?.url ??
    (typeof result.output === "string" ? result.output : (result.output as { url: string })?.url);

  if (!videoUrl) throw new Error("Fal.ai returned no video URL in result.");

  onProgress?.(100);
  onLog?.(`Done! Video: ${videoUrl}`);

  return { videoUrl, requestId: request_id };
}

// ── Build per-model payload ───────────────────────────────────────────────────
function buildPayload(
  input: FalInput,
  width: number,
  height: number,
): Record<string, unknown> {
  const base = {
    image_url:           input.imageDataUrl,
    prompt:              input.prompt,       // verbatim — no rewriting
    seed:                input.seed,
  };

  if (input.model === "wan") {
    return {
      ...base,
      num_frames:          Math.min(Math.round(input.durationSec * 16), 81),
      frames_per_second:   16,
      resolution:          `${width}x${height}`,
      num_inference_steps: 30,
      guidance_scale:      7.0,
    };
  }

  if (input.model === "ltx") {
    return {
      ...base,
      width,
      height,
      num_frames:          Math.min(Math.round(input.durationSec * 24), 121),
      frames_per_second:   24,
      num_inference_steps: 30,
      guidance_scale:      3.5,
    };
  }

  // minimax
  return {
    ...base,
    prompt_optimizer: false,   // pass through verbatim
  };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Check if key is configured ────────────────────────────────────────────────
export function falConfigured(): boolean {
  return !!(process.env.FAL_API_KEY?.trim());
}
