import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { GitGraph, AlertCircle } from "lucide-react";
import { api, GraphData } from "../lib/api";
import { ProofGraphCanvas } from "../components/ProofGraphCanvas";

export function ProofGraphPage() {
  const { id } = useParams<{ id: string }>();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "merged">("single");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getGraph(Number(id))
      .then(setGraph)
      .catch(() => setGraph(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="p-6 flex items-center gap-3 text-gray-500">
      <GitGraph className="w-5 h-5 animate-pulse" /> Loading transaction graph...
    </div>
  );

  if (!graph) return (
    <div className="p-6">
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
        <div>
          <p className="font-medium text-amber-700">Graph data not available</p>
          <p className="text-sm text-amber-600">Upload and confirm a statement first. <Link to="/" className="underline">Upload a statement</Link></p>
        </div>
      </div>
    </div>
  );

  const subjectNode = graph.nodes.find((n) => n.id === "ACCT_SUBJECT");
  const selectedNodeData = graph.nodes.find((n) => n.id === selectedNode);
  const selectedEdgeData = graph.edges.find((e) => e.row_id === selectedEdge);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Proof Graph</h1>
          <p className="text-gray-500 text-sm">Interactive transaction flow with cycle highlighting</p>
        </div>
        <div className="flex gap-2">
          {mode === "single" ? (
            <button onClick={() => setMode("merged")} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
              Merged View
            </button>
          ) : (
            <button onClick={() => setMode("single")} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
              Single Account
            </button>
          )}
          <Link to={`/dashboard/${id}`} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <div className="bg-white border rounded-lg overflow-hidden" style={{ height: "500px" }}>
            <ProofGraphCanvas
              nodes={graph.nodes}
              edges={graph.edges}
              cycles={graph.cycles}
              onNodeClick={(nodeId) => setSelectedNode(nodeId)}
              onEdgeClick={(edgeRowId) => setSelectedEdge(edgeRowId)}
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-2">Graph Summary</h3>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Nodes: {graph.nodes.length}</p>
              <p>Edges: {graph.edges.length}</p>
              <p>Cycles: {graph.cycles.length}</p>
              {subjectNode && <p>Total Flow: ₹{subjectNode.flow.toFixed(2)}</p>}
            </div>
          </div>

          {graph.cycles.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">Detected Cycles</h3>
              <div className="space-y-2">
                {graph.cycles.map((c) => (
                  <div key={c.cycle_id} className="text-xs border border-purple-200 bg-purple-50 rounded p-2">
                    <span className="font-bold text-purple-700">{c.cycle_id}</span>
                    <span className="ml-2">Risk: {(c.risk_score * 100).toFixed(0)}%</span>
                    <p className="text-gray-500 mt-1">{c.node_ids.join(" → ")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedNodeData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h3 className="font-semibold text-sm text-blue-700">Selected Node</h3>
              <p className="text-xs mt-1">{selectedNodeData.label}</p>
              <p className="text-xs text-gray-500">Flow: ₹{selectedNodeData.flow.toFixed(2)}</p>
            </div>
          )}

          {selectedEdgeData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h3 className="font-semibold text-sm text-blue-700">Selected Transaction</h3>
              <p className="text-xs mt-1">Row: {selectedEdgeData.row_id}</p>
              <p className="text-xs">Amount: ₹{selectedEdgeData.amount.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Channel: {selectedEdgeData.channel}</p>
            </div>
          )}

          <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-500">
            <p className="font-medium mb-1">Legend</p>
            <p><span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1" /> Account / Counterparty</p>
            <p><span className="inline-block w-3 h-3 bg-purple-500 rounded-full mr-1" /> Cycle participant</p>
            <p><span className="inline-block w-4 h-0.5 bg-gray-400 mr-1 align-middle" /> Transaction (width = amount)</p>
            <p className="mt-2 text-xs">Click a node or edge to inspect.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
