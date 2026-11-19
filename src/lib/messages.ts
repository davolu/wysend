export const STORAGE_KEYS = {
  settings: "settings",
  stats: "stats",
  vault: "vault",
  lastDiff: "lastDiff",
  lastAssist: "lastAssist",
  pendingSelection: "pendingSelection",
  nanoStatus: "nanoStatus",
  appCheckDebugToken: "appCheckDebugToken",
  remoteSnapshot: "remoteSnapshot",
} as const;

export interface DiffRecord {
  id: string;
  hostname: string;
  url: string;
  fieldId: string;
  before: string;
  after: string;
  findings: import("./redaction/types").Finding[];
  source: "rules" | "on_device";
  inferenceSource: import("./redaction/types").InferenceLabel | null;
  createdAt: number;
}

export interface SelectionCapture {
  text: string;
  hostname: string;
  url: string;
  fieldId: string;
  at: number;
}

export interface AssistRecord {
  task: import("./redaction/cloud").AssistTask;
  output: string;
  payload: string;
  bytes: number;
  inferenceSource: import("./redaction/types").InferenceLabel;
  mode: "PREFER_IN_CLOUD" | "ONLY_IN_CLOUD";
  at: number;
}

export type NanoState = "unknown" | "unsupported" | "unavailable" | "downloadable" | "downloading" | "ready" | "error";

export interface NanoStatus {
  state: NanoState;
  progress: number;
  message: string;
}

export type RuntimeMessage =
  | { type: "OPEN_PANEL" }
  | { type: "BADGE"; total: number }
  | { type: "APPLY_REDACTION"; fieldId: string; expected: string; next: string }
  | { type: "CAPTURE_SELECTION" }
  | { type: "INSERT_TEXT"; text: string };
