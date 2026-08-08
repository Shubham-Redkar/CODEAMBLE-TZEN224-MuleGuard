import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Download, AlertCircle, CheckCircle } from "lucide-react";
import { api, EvidenceBundle } from "../lib/api";

export function EvidenceExplorerPage() {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<EvidenceBundle | null>(null);
  const [rawJson, setRawJson] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getEvidence(Number(id))
      .then(setBundle)
      .catch(() => setBundle(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleExport = async () => {
    if (!id) return;
    try {
      await api.exportReport(Number(id));
    } catch {
      // fallback: download JSON
      if (bundle) {
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `evidence-${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading evidence bundle...</div>;
  if (!bundle) return <div className="p-6 text-red-500">Evidence not found. <Link to="/" className="text-blue-600 hover:underline">Upload a statement</Link></div>;

  const summary = bundle.account_summary || {};
  const decision = bundle.final_decision || {};
  const rules = bundle.triggered_rules || [];
  const features = bundle.features || [];
  const cycles = bundle.cycles_detected || [];
  const guardrail = bundle.guardrail_log || {};

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Evidence Explorer</h1>
          <p className="text-gray-500 text-sm">Full audit trail for statement {summary.statement_id as string}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRawJson(!rawJson)}
            className="px-4 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"
          >
            {rawJson ? "Formatted View" : "Raw JSON"}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {rawJson ? (
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto text-xs max-h-[70vh]">
          {JSON.stringify(bundle, null, 2)}
        </pre>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Account Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-400">Statement ID</span><p className="font-medium">{summary.statement_id as string}</p></div>
              <div><span className="text-gray-400">Period</span><p className="font-medium">{(summary.observed_period as any)?.start || "N/A"} — {(summary.observed_period as any)?.end || "N/A"}</p></div>
              <div><span className="text-gray-400">Transactions</span><p className="font-medium">{summary.transaction_count as number}</p></div>
              <div><span className="text-gray-400">Extraction Confidence</span><p className="font-medium">{((summary.extraction_confidence as number) * 100).toFixed(1)}%</p></div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Final Decision</h3>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-2 ${
              decision.tier === "CONFIRMED_SUSPICIOUS" ? "bg-red-100 text-red-700" :
              decision.tier === "LIKELY_LEGITIMATE" ? "bg-green-100 text-green-700" :
              "bg-amber-100 text-amber-700"
            }`}>{decision.tier as string}</div>
            <p>Fused Score: <strong>{(decision.fused_score as number).toFixed(1)}</strong> / 100</p>
            <p className="text-xs text-gray-400 mt-1">{decision.score_formula_used as string}</p>
          </div>

          {rules.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Triggered Rules ({rules.length})</h3>
              <div className="space-y-2">
                {rules.map((r) => (
                  <div key={r.id as string} className="border border-red-100 bg-red-50 rounded p-3 text-sm">
                    <div className="flex justify-between font-medium">
                      <span className="font-mono text-red-700">{r.id as string}</span>
                      <span>+{r.points as number} pts</span>
                    </div>
                    <p className="text-gray-600">{r.description as string}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {features.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Features ({features.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500 uppercase">
                      <th className="px-2 py-1">Name</th>
                      <th className="px-2 py-1">Value</th>
                      <th className="px-2 py-1">Formula</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {features.map((f) => (
                      <tr key={f.name as string} className="hover:bg-gray-50">
                        <td className="px-2 py-1 font-mono text-xs">{f.name as string}</td>
                        <td className="px-2 py-1">{f.value != null ? String(f.value) : "N/A"}</td>
                        <td className="px-2 py-1 text-xs text-gray-400">{f.formula as string}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {cycles.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Cycles Detected ({cycles.length})</h3>
              {cycles.map((c) => (
                <div key={c.cycle_id as string} className="border border-purple-200 bg-purple-50 rounded p-3 mb-2">
                  <p className="font-mono text-sm font-bold text-purple-700">{c.cycle_id as string}</p>
                  <p className="text-sm">{c.hop_count as number}-hop cycle · Risk: {((c.cycle_risk_score as number) * 100).toFixed(0)}%</p>
                  <p className="text-xs text-gray-500">Nodes: {(c.nodes as string[])?.join(" → ")}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Guardrail Log</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                {guardrail.ood_check_passed ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                <span>OOD Check: {guardrail.ood_check_passed ? "Passed" : "Failed"}</span>
              </div>
              <div>Reconciliation: {guardrail.reconciliation_rate != null ? `${((guardrail.reconciliation_rate as number) * 100).toFixed(1)}%` : "N/A"}</div>
              <div>Extraction: {guardrail.extraction_confidence as string}</div>
              <div>Manual Mapping: {guardrail.manual_mapping_used ? "Yes" : "No"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
