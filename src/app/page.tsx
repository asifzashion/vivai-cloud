"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Job, FalModel, AspectRatio } from "@/types";

// ── SSE hook ──────────────────────────────────────────────────────────────────
function useJobSSE(jobId: string | null, onUpdate: (j: Job) => void) {
  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`/api/status?jobId=${jobId}`);
    const handle = (e: MessageEvent) => { try { onUpdate(JSON.parse(e.data) as Job); } catch {} };
    es.addEventListener("progress", handle);
    es.addEventListener("done",     handle);
    es.addEventListener("error",    handle);
    es.onerror = () => {
      // Poll fallback
      const t = setInterval(async () => {
        try {
          const r = await fetch(`/api/status?jobId=${jobId}&sse=false`);
          if (r.ok) { const j = await r.json() as Job; onUpdate(j); if (j.status==="done"||j.status==="error") clearInterval(t); }
        } catch {}
      }, 3000);
      return () => clearInterval(t);
    };
    return () => es.close();
  }, [jobId, onUpdate]);
}

// ── Gallery type ───────────────────────────────────────────────────────────────
interface GalleryItem {
  id: string; videoUrl: string; prompt: string;
  model: string; aspectRatio: string; durationSec: number; createdAt: number;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Page() {
  const [tab,          setTab]         = useState<"create"|"gallery">("create");
  const [imageFile,    setImageFile]   = useState<File|null>(null);
  const [previewUrl,   setPreviewUrl]  = useState<string|null>(null);
  const [imageB64,     setImageB64]    = useState<string>("");
  const [prompt,       setPrompt]      = useState("");
  const [model,        setModel]       = useState<FalModel>("wan");
  const [aspect,       setAspect]      = useState<AspectRatio>("16:9");
  const [duration,     setDuration]    = useState(5);
  const [jobId,        setJobId]       = useState<string|null>(null);
  const [job,          setJob]         = useState<Job|null>(null);
  const [submitting,   setSubmitting]  = useState(false);
  const [submitErr,    setSubmitErr]   = useState<string|null>(null);
  const [keyOk,        setKeyOk]       = useState<boolean|null>(null);
  const [gallery,      setGallery]     = useState<GalleryItem[]>([]);
  const [galleryLoad,  setGalleryLoad] = useState(false);
  const [dragover,     setDragover]    = useState(false);
  const fileRef  = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const logRef   = useRef<HTMLDivElement>(null);

  // Check key on mount
  useEffect(() => {
    fetch("/api/check-key").then(r=>r.json()).then((d:{configured:boolean}) => setKeyOk(d.configured)).catch(()=>setKeyOk(false));
  }, []);

  // Auto-scroll logs
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [job?.logs]);

  // SSE
  const handleJobUpdate = useCallback((j: Job) => setJob(j), []);
  useJobSSE(jobId, handleJobUpdate);

  // Load gallery when tab opens
  useEffect(() => {
    if (tab !== "gallery") return;
    setGalleryLoad(true);
    fetch("/api/gallery").then(r=>r.json()).then((d:{items:GalleryItem[]}) => setGallery(d.items)).catch(()=>{}).finally(()=>setGalleryLoad(false));
  }, [tab, job?.status]);

  // ── File load ──────────────────────────────────────────────────────────────
  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    // Convert to base64
    const reader = new FileReader();
    reader.onload = e => setImageB64(e.target?.result as string ?? "");
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragover(false);
    const f = e.dataTransfer.files[0]; if (f) loadFile(f);
  }, [loadFile]);

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!imageB64)       { setSubmitErr("Upload an image first."); return; }
    if (!prompt.trim())  { setSubmitErr("Write a motion prompt."); promptRef.current?.focus(); return; }
    if (!keyOk)          { setSubmitErr("FAL_API_KEY not configured — see setup guide below."); return; }

    setSubmitting(true); setSubmitErr(null); setJob(null); setJobId(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), imageBase64: imageB64, model, aspectRatio: aspect, durationSec: duration }),
      });
      const data = await res.json() as { jobId?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setJobId(data.jobId!);
    } catch (err) {
      setSubmitErr(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNew = () => { setJobId(null); setJob(null); setImageFile(null); setPreviewUrl(null); setImageB64(""); setPrompt(""); setSubmitErr(null); };

  const isRunning = job && job.status !== "done" && job.status !== "error";
  const isDone    = job?.status === "done";
  const isError   = job?.status === "error";

  const aspectPadding = aspect === "9:16" ? "pb-[177%]" : aspect === "1:1" ? "pb-[100%]" : "pb-[56%]";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-bg">

      {/* Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-accent/20 blur-[120px] -top-32 -left-32 animate-drift-a" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-pink/15  blur-[100px] bottom-0 right-0  animate-drift-b" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-cyan/10  blur-[80px]  top-1/2 left-1/2 -translate-x-1/2 animate-drift-c" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-20 sticky top-0 safe-t backdrop-blur-2xl bg-bg/70 border-b border-white/[0.06]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-pink flex items-center justify-center text-sm font-black">V</div>
            <span className="font-black text-lg g-text">VivAI</span>
          </div>

          {/* Key status */}
          {keyOk !== null && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border
              ${keyOk ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${keyOk ? "bg-emerald-400" : "bg-red-400"}`} />
              {keyOk ? "Fal.ai · Ready" : "No API Key"}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="max-w-lg mx-auto px-4 pb-2 flex gap-1.5">
          {(["create","gallery"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[.98]
                ${tab===t ? "bg-accent/20 border border-accent/30 text-accent3" : "text-muted hover:text-white"}`}>
              {t === "create" ? "✨ Create" : "🗂 Gallery"}
            </button>
          ))}
        </div>
      </header>

      {/* ── Body ── */}
      <main className="relative z-10 flex-1 max-w-lg mx-auto w-full px-4 py-5 space-y-4 safe-b pb-10">

        {/* ══ No key banner ══ */}
        {keyOk === false && (
          <div className="bg-surface2 border border-accent/20 rounded-2xl p-4 space-y-3">
            <p className="font-bold text-sm text-white">🔑 Add your free Fal.ai API key</p>
            <p className="text-xs text-muted">Fal.ai has a free tier with $5 credit — enough for ~50 videos.</p>

            <div className="space-y-2">
              <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer"
                className="flex items-center justify-between bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded-xl px-4 py-3 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-white">1. Get free key at fal.ai</p>
                  <p className="text-xs text-muted mt-0.5">Sign up → Dashboard → Keys → Copy</p>
                </div>
                <span className="text-accent3 text-lg">↗</span>
              </a>

              <div className="bg-black/40 border border-white/8 rounded-xl p-3 space-y-1.5 font-mono text-xs">
                <p className="text-white/40"># For Vercel deployment:</p>
                <p className="text-accent3">Settings → Environment Variables</p>
                <p className="text-white/60">FAL_API_KEY = <span className="text-white">fal_xxxxxxxxxxxx</span></p>
                <div className="border-t border-white/8 pt-1.5 mt-1.5">
                  <p className="text-white/40"># For local testing:</p>
                  <p className="text-white/60">.env.local → FAL_API_KEY=fal_xxx</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ CREATE TAB ══ */}
        {tab === "create" && (
          <>
            {/* New video button */}
            {(isDone || isError) && (
              <button onClick={handleNew}
                className="w-full py-2.5 rounded-2xl border border-white/10 text-sm text-muted hover:text-white hover:border-white/20 transition-colors active:scale-[.98]">
                ← New Video
              </button>
            )}

            {/* Video player (done) */}
            {isDone && job?.videoUrl && (
              <div className="bg-surface2 border border-white/8 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <span className="text-sm font-semibold">🎬 Your Video</span>
                  <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-0.5 font-semibold">Done</span>
                </div>
                <div className="bg-black">
                  <video key={job.videoUrl} controls autoPlay loop playsInline
                    className="w-full max-h-[55vh] object-contain"
                    src={job.videoUrl} />
                </div>
                <div className="p-3 flex gap-2">
                  <a href={job.videoUrl} download target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-accent to-pink text-white font-semibold text-sm active:scale-[.98] transition-transform">
                    ⬇️ Download MP4
                  </a>
                  <button onClick={handleNew}
                    className="px-4 py-3 rounded-xl border border-white/10 text-muted text-sm hover:text-white hover:border-white/20 transition-colors">
                    New
                  </button>
                </div>
              </div>
            )}

            {/* Progress panel */}
            {isRunning && job && (
              <div className="bg-surface2 border border-white/8 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-accent2 pulse-ring" />
                    <span className="text-sm font-semibold text-white capitalize">{job.status}…</span>
                  </div>
                  <span className="text-accent3 font-bold tabular-nums">{job.progress}%</span>
                </div>

                {/* Bar */}
                <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${job.progress}%`, background: "linear-gradient(90deg,#7c3aed,#ec4899)" }} />
                </div>

                {/* Logs */}
                {job.logs.length > 0 && (
                  <div ref={logRef}
                    className="log-box bg-black/40 border border-white/8 rounded-xl p-3 max-h-28 overflow-y-auto space-y-0.5">
                    {job.logs.map((l,i) => (
                      <p key={i} className="text-[11px] text-muted font-mono leading-relaxed">{l}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {isError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                <p className="text-red-400 font-semibold text-sm">⚠️ Generation failed</p>
                <p className="text-red-400/70 text-xs mt-1">{job?.error}</p>
              </div>
            )}

            {/* ── Form (hide while running) ── */}
            {!isRunning && (
              <div className="space-y-4">

                {/* Image upload */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-widest">📸 Seed Image (Frame 1)</label>
                  <div
                    className={`relative w-full ${aspectPadding} rounded-2xl overflow-hidden border-2 cursor-pointer transition-all
                      ${dragover ? "border-accent2 bg-accent/10 scale-[.99]"
                        : previewUrl ? "border-white/10"
                        : "border-dashed border-white/15 hover:border-accent2 hover:bg-accent/5"}`}
                    onDragOver={e=>{e.preventDefault();setDragover(true)}}
                    onDragLeave={()=>setDragover(false)}
                    onDrop={onDrop}
                    onClick={()=>fileRef.current?.click()}
                  >
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e=>{ const f=e.target.files?.[0]; if(f) loadFile(f); }} />

                    {previewUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} alt="Seed" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <span className="text-white text-sm font-semibold bg-black/60 px-3 py-1.5 rounded-full">🔄 Replace</span>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                        <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center">
                          <svg className="w-7 h-7 text-accent3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <p className="text-white text-sm font-semibold">Tap to upload or use camera</p>
                          <p className="text-muted text-xs mt-0.5">JPG · PNG · WEBP</p>
                        </div>
                        <p className="text-white/20 text-xs">This becomes Frame 1 of your video</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Prompt */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-widest">✍️ Motion Prompt</label>
                  <textarea ref={promptRef} value={prompt} onChange={e=>setPrompt(e.target.value)} rows={3}
                    placeholder={"Describe the motion…\ne.g. 'slow cinematic zoom in, wind in hair, petals falling'"}
                    className="w-full bg-surface2 border border-white/8 rounded-2xl p-3.5 text-white placeholder-white/20 resize-none outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all leading-relaxed" />
                  <p className="text-[11px] text-white/20">Sent verbatim to the model — no filtering.</p>
                </div>

                {/* Aspect ratio */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-widest">📐 Aspect Ratio</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["16:9","9:16","1:1"] as AspectRatio[]).map(r => (
                      <button key={r} onClick={()=>setAspect(r)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-[.97]
                          ${aspect===r ? "bg-accent/20 border-accent/40 text-accent3" : "border-white/8 text-muted hover:border-white/20 hover:text-white"}`}>
                        {r==="16:9" ? "▬ 16:9" : r==="9:16" ? "◼ 9:16" : "■ 1:1"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-[11px] font-semibold text-muted uppercase tracking-widest">⏱ Duration</label>
                    <span className="text-accent3 font-bold text-sm tabular-nums">{duration}s</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[3,5,8,10].map(d => (
                      <button key={d} onClick={()=>setDuration(d)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all active:scale-[.97]
                          ${duration===d ? "bg-accent/20 border-accent/40 text-accent3" : "border-white/8 text-muted hover:border-white/20"}`}>
                        {d}s
                      </button>
                    ))}
                  </div>
                  <input type="range" min={3} max={10} step={1} value={duration} onChange={e=>setDuration(Number(e.target.value))} />
                  <div className="flex justify-between text-[10px] text-white/20"><span>3s</span><span>10s</span></div>
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-widest">🤖 Model</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id:"wan",     name:"Wan 2.2",  sub:"Best quality" },
                      { id:"ltx",     name:"LTX 2.5",  sub:"Fast" },
                      { id:"minimax", name:"MiniMax",  sub:"Cinematic" },
                    ].map(m => (
                      <button key={m.id} onClick={()=>setModel(m.id as FalModel)}
                        className={`py-2.5 px-2 rounded-xl border transition-all active:scale-[.97] text-left
                          ${model===m.id ? "bg-accent/20 border-accent/40" : "border-white/8 hover:border-white/20"}`}>
                        <p className={`text-xs font-semibold ${model===m.id ? "text-accent3" : "text-white"}`}>{m.name}</p>
                        <p className="text-[10px] text-muted mt-0.5">{m.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {submitErr && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                    <p className="text-red-400 text-xs">{submitErr}</p>
                  </div>
                )}

                {/* Generate */}
                <button onClick={handleGenerate} disabled={submitting || !imageB64}
                  className={`w-full py-4 rounded-2xl font-bold text-base text-white transition-all active:scale-[.98]
                    ${submitting || !imageB64
                      ? "bg-white/8 text-white/25 cursor-not-allowed"
                      : "bg-gradient-to-r from-accent via-accent2 to-pink shadow-xl shadow-accent/25"}`}>
                  {submitting
                    ? <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>Starting…
                      </span>
                    : `✨ Generate ${duration}s Video`}
                </button>

                {!imageB64 && (
                  <p className="text-center text-xs text-white/20">Upload an image above to unlock generation</p>
                )}
              </div>
            )}
          </>
        )}

        {/* ══ GALLERY TAB ══ */}
        {tab === "gallery" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">My Videos</h2>
              <span className="text-xs text-muted">{gallery.length} video{gallery.length!==1?"s":""}</span>
            </div>

            {galleryLoad && (
              <div className="grid grid-cols-2 gap-2">
                {[1,2,3,4].map(i=><div key={i} className="aspect-video bg-surface2 rounded-xl shimmer"/>)}
              </div>
            )}

            {!galleryLoad && gallery.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-5xl mb-4 opacity-20">🎞️</span>
                <p className="text-muted text-sm">No videos yet</p>
                <p className="text-muted/50 text-xs mt-1">Generated videos appear here</p>
              </div>
            )}

            {!galleryLoad && gallery.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {gallery.map(item => (
                  <div key={item.id} className="group relative rounded-xl overflow-hidden bg-surface2 border border-white/8">
                    <video src={item.videoUrl} className="w-full aspect-video object-cover" muted playsInline preload="metadata"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                      <p className="text-[10px] text-white/70 truncate">{item.prompt}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-muted">{item.model}</span>
                        <span className="text-[9px] text-muted">·</span>
                        <span className="text-[9px] text-muted">{item.durationSec}s</span>
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 right-2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={item.videoUrl} download target="_blank" rel="noreferrer"
                        className="text-[10px] bg-black/70 text-white rounded-lg px-2 py-1 font-medium">⬇️ Save</a>
                      <button onClick={async()=>{await fetch(`/api/gallery?jobId=${item.id}`,{method:"DELETE"});setGallery(g=>g.filter(x=>x.id!==item.id));}}
                        className="text-[10px] bg-black/70 text-white/60 rounded-lg px-2 py-1 hover:text-red-400">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[.04] py-3 text-center safe-b">
        <p className="text-[10px] text-white/15">VivAI · Powered by Fal.ai · Zero censorship</p>
      </footer>
    </div>
  );
}
