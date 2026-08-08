const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export type HealthStatus = {
  status: string;
  app: string;
  version: string;
  timestamp: string;
  offline_mode: boolean;
};

export type StatementPreview = {
  statement_id: number;
  status: string;
  ood_score: number;
  ood_signals: Record<string, number>;
  reconciliation_rate: number;
  extraction_confidence: number;
  row_count: number;
  detected_columns: Record<string, string>;
};

export type EvidenceBundle = {
  account_summary: Record<string, unknown>;
  final_decision: Record<string, unknown>;
  triggered_rules: Record<string, unknown>[];
  features: Record<string, unknown>[];
  cycles_detected: Record<string, unknown>[];
  anomaly_detail: Record<string, unknown> | null;
  supervised_detail: Record<string, unknown> | null;
  guardrail_log: Record<string, unknown>;
};

export type GraphData = {
  nodes: { id: string; label: string; flow: number }[];
  edges: { source: string; target: string; amount: number; channel: string; row_id: string }[];
  cycles: { cycle_id: string; node_ids: string[]; risk_score: number }[];
};

export type PagedTransactions = {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
};

export const api = {
  health: () => request<HealthStatus>("/health"),
  offlineCheck: () => request<{ status: string; message: string }>("/health/offline-check"),

  upload: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return request<{ statement_ids: number[]; results: Record<string, unknown>[] }>("/statements/upload", {
      method: "POST",
      body: form,
    });
  },

  getPreview: (id: number) => request<StatementPreview>(`/statements/${id}/preview`),

  updateMapping: (id: number, mapping: Record<string, string>) =>
    request<{ status: string }>(`/statements/${id}/mapping`, {
      method: "POST",
      body: JSON.stringify(mapping),
    }),

  confirmExtraction: (id: number) =>
    request<{ status: string }>(`/statements/${id}/confirm`, { method: "POST" }),

  getEvidence: (id: number) => request<EvidenceBundle>(`/statements/${id}/evidence`),

  getTransactions: (id: number, page = 1, pageSize = 100) =>
    request<PagedTransactions>(`/statements/${id}/transactions?page=${page}&page_size=${pageSize}`),

  getGraph: (id: number) => request<GraphData>(`/statements/${id}/graph`),

  getNarrative: (id: number) => request<{ text: string; source: string }>(`/statements/${id}/narrative`),

  batchMerge: (statement_ids: number[]) =>
    request<{ status: string; merged_graph: GraphData }>("/statements/batch/merge", {
      method: "POST",
      body: JSON.stringify({ statement_ids }),
    }),

  exportReport: (id: number) =>
    request<{ download_url: string }>(`/statements/${id}/export`, { method: "POST" }),

  getConfig: () => request<Record<string, unknown>>("/config/thresholds"),

  updateConfig: (config: Record<string, unknown>) =>
    request<{ status: string }>("/config/thresholds", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
};
