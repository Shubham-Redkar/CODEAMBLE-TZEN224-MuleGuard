import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle, ArrowRight } from "lucide-react";
import { api, StatementPreview } from "../lib/api";

const CANONICAL_FIELDS = [
  "txn_date", "value_date", "narration", "debit_amount",
  "credit_amount", "balance_after", "reference_no",
];

export function ExtractionReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getPreview(Number(id))
      .then((data) => {
        setPreview(data);
        setMapping(data.detected_columns || {});
      })
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleConfirm = async () => {
    if (!id) return;
    await api.confirmExtraction(Number(id));
    navigate(`/dashboard/${id}`);
  };

  if (loading) return <div className="p-6 text-gray-500">Loading extraction preview...</div>;
  if (!preview) return <div className="p-6 text-red-500">Statement not found.</div>;

  const confidenceLevel = preview.extraction_confidence >= 0.98 ? "high" : preview.extraction_confidence >= 0.85 ? "medium" : "low";
  const confidenceColor = confidenceLevel === "high" ? "text-green-600 bg-green-50 border-green-200" : confidenceLevel === "medium" ? "text-amber-600 bg-amber-50 border-amber-200" : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Extraction Review</h1>
      <p className="text-gray-500 mb-6">Review the detected column mapping before analysis.</p>

      <div className={`rounded-lg border p-4 mb-6 ${confidenceColor}`}>
        <div className="flex items-center gap-2 mb-1">
          {confidenceLevel === "high" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-semibold">
            Extraction Confidence: {(preview.extraction_confidence * 100).toFixed(1)}%
          </span>
          {preview.reconciliation_rate != null && (
            <span className="text-sm ml-4">
              Reconciliation: {(preview.reconciliation_rate * 100).toFixed(1)}%
            </span>
          )}
        </div>
        {confidenceLevel === "low" && (
          <p className="text-sm mt-1">Low confidence — manual review of column mapping is recommended.</p>
        )}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="bg-gray-50 border-b px-4 py-3 font-medium">
          Column Mapping — {preview.row_count} rows detected
        </div>
        {preview.detected_columns && Object.entries(mapping).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
            {Object.entries(mapping).map(([col, field]) => (
              <div key={col} className="border rounded p-2">
                <div className="text-xs text-gray-400 mb-1">Column: {col}</div>
                <select
                  value={field}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [col]: e.target.value }))}
                  className="w-full text-sm border rounded px-2 py-1"
                >
                  <option value="">— ignore —</option>
                  {CANONICAL_FIELDS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={confidenceLevel === "low"}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
        >
          Confirm & Analyze <ArrowRight className="w-4 h-4" />
        </button>
        {confidenceLevel === "low" && (
          <p className="text-sm text-gray-400 self-center">Confirm disabled until confidence is acceptable</p>
        )}
      </div>
    </div>
  );
}
