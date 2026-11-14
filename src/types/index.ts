export type JobStatus =
  | "queued" | "uploading" | "generating" | "done" | "error";

export type AspectRatio = "16:9" | "9:16" | "1:1";
export type FalModel    = "wan" | "ltx" | "minimax";

export interface Job {
  id:          string;
  status:      JobStatus;
  prompt:      string;
  model:       FalModel;
  aspectRatio: AspectRatio;
  durationSec: number;
  progress:    number;      // 0-100
  logs:        string[];
  videoUrl?:   string;      // fal CDN URL (permanent)
  thumbUrl?:   string;
  error?:      string;
  createdAt:   number;
  updatedAt:   number;
}

export interface GenerateRequest {
  prompt:      string;
  imageBase64: string;      // data:image/...;base64,...
  model:       FalModel;
  aspectRatio: AspectRatio;
  durationSec: number;      // 5 | 8 | 10
  seed?:       number;
}

export interface SSEPayload {
  type:  "progress" | "done" | "error" | "log";
  job:   Job;
}
