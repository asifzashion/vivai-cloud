/**
 * GET /api/status?jobId=xxx
 * Server-Sent Events stream for real-time progress.
 */
import { NextRequest } from "next/server";
import { jobStore }    from "@/lib/jobStore";
import { SSEPayload }  from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return new Response("jobId required", { status: 400 });

  const enc = new TextEncoder();
  const fmt = (p: SSEPayload) => `event: ${p.type}\ndata: ${JSON.stringify(p.job)}\n\n`;

  const stream = new ReadableStream({
    start(ctrl) {
      const job = jobStore.get(jobId);

      // Send current snapshot
      if (job) {
        const type: SSEPayload["type"] =
          job.status === "done" ? "done" : job.status === "error" ? "error" : "progress";
        ctrl.enqueue(enc.encode(fmt({ type, job })));
        if (job.status === "done" || job.status === "error") {
          ctrl.close(); return;
        }
      }

      // Subscribe to updates
      const unsub = jobStore.subscribe(jobId, (payload) => {
        try {
          ctrl.enqueue(enc.encode(fmt(payload)));
          if (payload.type === "done" || payload.type === "error") {
            unsub(); ctrl.close();
          }
        } catch { unsub(); }
      });

      // Heartbeat — keeps connection alive through Vercel edge
      const hb = setInterval(() => {
        try { ctrl.enqueue(enc.encode(": ping\n\n")); }
        catch { clearInterval(hb); unsub(); }
      }, 20_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(hb); unsub();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-store",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
