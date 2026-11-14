/**
 * In-memory job store + SSE subscriber bus.
 * Persists jobs for the lifetime of the server process.
 */
import { Job, SSEPayload } from "@/types";

type Subscriber = (payload: SSEPayload) => void;

class JobStore {
  private jobs        = new Map<string, Job>();
  private subscribers = new Map<string, Set<Subscriber>>();

  set(job: Job): void {
    this.jobs.set(job.id, { ...job, updatedAt: Date.now() });
    this.publish(job.id);
  }

  update(id: string, patch: Partial<Job>): void {
    const existing = this.jobs.get(id);
    if (!existing) return;
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    this.jobs.set(id, updated);
    this.publish(id);
  }

  get(id: string): Job | undefined { return this.jobs.get(id); }

  getAll(): Job[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  subscribe(id: string, fn: Subscriber): () => void {
    if (!this.subscribers.has(id)) this.subscribers.set(id, new Set());
    this.subscribers.get(id)!.add(fn);
    return () => this.subscribers.get(id)?.delete(fn);
  }

  delete(id: string): void {
    this.jobs.delete(id);
    this.subscribers.delete(id);
  }

  private publish(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    const type: SSEPayload["type"] =
      job.status === "done"  ? "done"  :
      job.status === "error" ? "error" : "progress";
    const payload: SSEPayload = { type, job };
    this.subscribers.get(id)?.forEach(fn => fn(payload));
  }
}

declare global { var __jobStore: JobStore | undefined; }
export const jobStore: JobStore =
  global.__jobStore ?? (global.__jobStore = new JobStore());
