import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Download, AlertCircle, CheckCircle, Search, LayoutDashboard, GitGraph, Upload, ArrowRight } from "lucide-react";
import { api, EvidenceBundle } from "../lib/api";
import { useStatement } from "../lib/StatementContext";

export function EvidenceExplorerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentId, setCurrentId, statements } = useStatement();

  const effectiveId = id ? Number(id) : currentId;

  const [bundle, setBundle] = useState<EvidenceBundle | null>(null);
  const [rawJson, setRawJson] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && Number(id) !== currentId) {
      setCurrentId(Number(id));
    }
  }, [id, currentId, setCurrentId]);

  useEffect(() => {
    if (!effectiveId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.getEvidence(effectiveId)
      .then(setBundle)
      .catch(() => setBundle(null))
      .finally(() => setLoading(false));
  }, [effectiveId]);

  const handleExport = async () => {
    if (!effectiveId) return;
    try {
      await api.exportReport(effectiveId);
    } catch {
      // fallback: download JSON
      if (bundle) {
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `evidence-${effectiveId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-gray-500 flex items-center gap-2">
        <Search className="w-5 h-5 animate-pulse text-blue-600" /> Loading evidence bundle...
      </div>
    );
  }

  if (!effectiveId || !bundle) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white border rounded-xl p-8 text-center shadow-sm space-y-4">
          <Search className="w-12 h-12 mx-auto text-gray-400" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {!effectiveId ? "No Statement Selected" : `Evidence Bundle Not Found for Statement #${effectiveId}`}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {!effectiveId
                ? "Select a statement from history or upload a new statement."
                : "Make sure you have confirmed extraction to generate the evidence bundle."}
            </p>
          </div>

          {effectiveId && (
            <div>
              <button
                onClick={() => navigate(`/review/${effectiveId}`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
              >
                Review & Confirm Extraction <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {statements.length > 0 && (
            <div className="mt-6 pt-6 border-t text-left">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Available Statements</h3>
              <div className="max-w-md mx-auto border rounded-lg divide-y bg-gray-50/50">
                {statements.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setCurrentId(s.id);
                      navigate(`/evidence/${s.id}`);
                    }}
                    className="w-full p-3 text-left hover:bg-blue-50/50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-gray-800">#{s.id}: {s.original_filename}</span>
                      <p className="text-[11px] text-gray-500 mt-0.5">{s.transaction_count || 0} txns · {s.tier || s.status}</p>
                    </div>
                    <span className="text-blue-600 font-semibold">View Evidence →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Upload className="w-3.5 h-3.5" /> Upload New Statement
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const summary = bundle.account_summary || {};
  const decision = bundle.final_decision || {};
  const rules = bundle.triggered_rules || [];
  const features = bundle.features || [];
  const cycles = bundle.cycles_detected || [];
  const guardrail = bundle.guardrail_log || {};

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Evidence Explorer</h1>
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
              Statement #{effectiveId}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">Full audit trail & deterministic proof bundle</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/dashboard/${effectiveId}`}
            className="px-3 py-2 bg-white border rounded-lg text-xs font-medium hover:bg-gray-50 flex items-center gap-1.5 shadow-sm"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" /> Dashboard
          </Link>
          <Link
            to={`/graph/${effectiveId}`}
            className="px-3 py-2 bg-white border rounded-lg text-xs font-medium hover:bg-gray-50 flex items-center gap-1.5 shadow-sm"
          >
            <GitGraph className="w-3.5 h-3.5 text-purple-600" /> Proof Graph
          </Link>
          <button
            onClick={() => setRawJson(!rawJson)}
            className="px-3 py-2 bg-white border rounded-lg text-xs font-medium hover:bg-gray-50 shadow-sm"
          >
            {rawJson ? "Formatted View" : "Raw JSON"}
          </button>
          <button
            onClick={handleExport}
            className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {rawJson ? (
        <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-auto text-xs max-h-[70vh] shadow-inner font-mono">
          {JSON.stringify(bundle, null, 2)}
        </pre>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-800 mb-3">Account Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-400 text-xs">Statement ID</span><p className="font-semibold text-gray-800">#{effectiveId}</p></div>
              <div><span className="text-gray-400 text-xs">Observed Period</span><p className="font-semibold text-gray-800">{(summary.observed_period as any)?.start || "N/A"} — {(summary.observed_period as any)?.end || "N/A"}</p></div>
              <div><span className="text-gray-400 text-xs">Total Transactions</span><p className="font-semibold text-gray-800">{summary.transaction_count as number}</p></div>
              <div><span className="text-gray-400 text-xs">Extraction Confidence</span><p className="font-semibold text-gray-800">{summary.extraction_confidence != null ? `${((summary.extraction_confidence as number) * 100).toFixed(1)}%` : "N/A"}</p></div>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-800 mb-3">Final Decision & Score Breakdown</h3>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                decision.tier === "CONFIRMED_SUSPICIOUS" ? "bg-red-100 text-red-700" :
                decision.tier === "LIKELY_LEGITIMATE" ? "bg-green-100 text-green-700" :
                "bg-amber-100 text-amber-700"
              }`}>{decision.tier as string}</span>
              <span className="text-sm text-gray-700">Fused Score: <strong>{(decision.fused_score as number)?.toFixed(1)}</strong> / 100</span>
            </div>
            <p className="text-xs font-mono text-gray-500 mt-2 bg-gray-50 p-2 rounded border">{decision.score_formula_used as string}</p>
          </div>

          {rules.length > 0 && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-sm text-gray-800 mb-3">Triggered Rules ({rules.length})</h3>
              <div className="space-y-2">
                {rules.map((r) => (
                  <div key={r.id as string} className="border border-red-100 bg-red-50/70 rounded-lg p-3 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="font-mono text-red-700">{r.id as string}</span>
                      <span className="text-red-800">+{r.points as number} pts</span>
                    </div>
                    <p className="text-gray-700 mt-1">{r.description as string}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {features.length > 0 && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-sm text-gray-800 mb-3">Deterministic Features ({features.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-gray-500 uppercase tracking-wider bg-gray-50/50">
                      <th className="px-3 py-2">Feature</th>
                      <th className="px-3 py-2">Value</th>
                      <th className="px-3 py-2">Formula</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {features.map((f) => (
                      <tr key={f.name as string} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-900 font-semibold">{f.name as string}</td>
                        <td className="px-3 py-2 font-medium">{f.value != null ? (typeof f.value === "number" ? f.value.toFixed(3) : String(f.value)) : "N/A"}</td>
                        <td className="px-3 py-2 font-mono text-gray-400 text-[11px]">{f.formula as string}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {cycles.length > 0 && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-sm text-gray-800 mb-3">Cycles Detected ({cycles.length})</h3>
              {cycles.map((c) => (
                <div key={c.cycle_id as string} className="border border-purple-200 bg-purple-50/70 rounded-lg p-3 mb-2 text-xs">
                  <p className="font-mono font-bold text-purple-800">{c.cycle_id as string}</p>
                  <p className="mt-0.5">{c.hop_count as number}-hop cycle · Risk: {((c.cycle_risk_score as number) * 100).toFixed(0)}%</p>
                  <p className="text-gray-500 mt-1 font-mono">Sequence: {(c.nodes as string[])?.join(" → ")}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-800 mb-3">Guardrail Log</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                {guardrail.ood_check_passed ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                <span className="font-medium">OOD Check: {guardrail.ood_check_passed ? "Passed" : "Failed"}</span>
              </div>
              <div>Reconciliation Rate: <strong>{guardrail.reconciliation_rate != null ? `${((guardrail.reconciliation_rate as number) * 100).toFixed(1)}%` : "N/A"}</strong></div>
              <div>Extraction Confidence: <strong>{guardrail.extraction_confidence as string}</strong></div>
              <div>Manual Mapping Used: <strong>{guardrail.manual_mapping_used ? "Yes" : "No"}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
