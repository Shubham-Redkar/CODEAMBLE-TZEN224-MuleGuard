import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { RiskGauge } from "../components/RiskGauge";
import { MetricCard } from "../components/MetricCard";
import { RuleTriggerList } from "../components/RuleTriggerList";
import { TransactionTable } from "../components/TransactionTable";
import { NarrativePanel } from "../components/NarrativePanel";
import { api, EvidenceBundle } from "../lib/api";

export function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<EvidenceBundle | null>(null);
  const [narrative, setNarrative] = useState<{ text: string; source: string } | null>(null);
  const [transactions, setTransactions] = useState<{ rows: Record<string, unknown>[]; total: number }>({ rows: [], total: 0 });
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!id) return;
    api.getEvidence(Number(id)).then(setBundle).catch(() => setBundle(null));
    api.getTransactions(Number(id)).then(setTransactions).catch(() => {});
    loadNarrative();
  }, [id]);

  const loadNarrative = async () => {
    if (!id) return;
    try {
      const n = await api.getNarrative(Number(id));
      setNarrative(n);
    } catch {
      setNarrative(null);
    }
  };

  const features = bundle?.features || [];
  const rules = bundle?.triggered_rules || [];
  const decision = bundle?.final_decision || {};
  const cycles = bundle?.cycles_detected || [];

  const summary = bundle?.account_summary || {};
  const tier = (decision.tier as string) || "REVIEW_REQUIRED";
  const score = (decision.fused_score as number) || 0;

  const chartData = features
    .filter((f) => typeof f.value === "number")
    .slice(0, 10)
    .map((f) => ({ name: f.name, value: f.value as number, family: f.family }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Statement: {summary.statement_id as string} | {summary.transaction_count as number} transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/graph/${id}`} className="px-4 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50">
            View Graph
          </Link>
          <Link to={`/evidence/${id}`} className="px-4 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50">
            Evidence Bundle
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-1">
          <RiskGauge score={score} tier={tier as "CONFIRMED_SUSPICIOUS" | "REVIEW_REQUIRED" | "LIKELY_LEGITIMATE"} />
          <div className="mt-2 text-xs text-gray-400 text-center">{decision.score_formula_used as string}</div>
        </div>
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {features.slice(0, 8).map((f) => (
            <MetricCard
              key={f.name as string}
              title={f.name as string}
              value={f.value != null ? (typeof f.value === "number" ? f.value.toFixed(2) : String(f.value)) : "N/A"}
              formula={f.formula as string}
              explanation={f.explanation as string}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1">
          <h3 className="font-semibold mb-3">Triggered Rules</h3>
          <RuleTriggerList rules={rules as any[]} />
          {cycles.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Detected Cycles</h4>
              {cycles.map((c) => (
                <div key={c.cycle_id as string} className="border border-purple-200 bg-purple-50 rounded-lg p-3 mb-2">
                  <div className="font-mono text-xs font-bold text-purple-700">{c.cycle_id as string}</div>
                  <div className="text-sm">{c.hop_count as number}-hop cycle</div>
                  <div className="text-xs text-gray-500">Risk: {((c.cycle_risk_score as number) * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="lg:col-span-2 space-y-4">
          {chartData.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Feature Values</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {narrative && (
            <NarrativePanel
              text={narrative.text}
              source={narrative.source as "ai" | "template"}
            />
          )}
        </div>
      </div>

      <div className="bg-white border rounded-lg">
        <div className="border-b px-4 py-3 font-medium">Transaction Table</div>
        <TransactionTable
          rows={transactions.rows as any[]}
          total={transactions.total}
          page={page}
          pageSize={100}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
