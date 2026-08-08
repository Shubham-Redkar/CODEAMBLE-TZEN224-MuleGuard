import { useEffect, useRef } from "react";
import cytoscape, { Core, ElementDefinition } from "cytoscape";

type GraphNode = { id: string; label: string; flow: number };
type GraphEdge = { source: string; target: string; amount: number; channel: string; row_id: string };
type CycleInfo = { cycle_id: string; node_ids: string[]; risk_score: number };

type ProofGraphCanvasProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  cycles: CycleInfo[];
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeRowId: string) => void;
};

export function ProofGraphCanvas({ nodes, edges, cycles, onNodeClick, onEdgeClick }: ProofGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const maxFlow = Math.max(...nodes.map((n) => n.flow), 1);
    const maxAmount = Math.max(...edges.map((e) => e.amount), 1);

    const elements: ElementDefinition[] = [
      ...nodes.map((n) => ({
        data: { id: n.id, label: n.label, flow: n.flow },
        style: { width: 20 + (n.flow / maxFlow) * 60, height: 20 + (n.flow / maxFlow) * 60 },
      })),
      ...edges.map((e) => ({
        data: { source: e.source, target: e.target, label: `₹${e.amount}`, amount: e.amount, channel: e.channel, row_id: e.row_id },
        style: { width: 1 + (e.amount / maxAmount) * 6 },
      })),
    ];

    const cycleNodeIds = new Set(cycles.flatMap((c) => c.node_ids));

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        { selector: "node", style: { label: "data(label)", "text-valign": "center", "text-halign": "center", "background-color": "#3b82f6", color: "#fff", "font-size": "10px" } },
        { selector: "node:selected", style: { "background-color": "#ef4444" } },
        { selector: "edge", style: { width: 2, "line-color": "#94a3b8", "target-arrow-color": "#94a3b8", "target-arrow-shape": "triangle", "curve-style": "bezier", "arrow-scale": 0.8, "font-size": "8px" } },
        { selector: "edge:selected", style: { "line-color": "#ef4444", "target-arrow-color": "#ef4444" } },
        ...Array.from(cycleNodeIds).map((id) => ({
          selector: `#${id.replace(/[^\w-]/g, "_")}`,
          style: { "border-color": "#a855f7", "border-width": 3, "background-color": "#a855f7" },
        })),
      ],
      layout: { name: "cose", animate: false },
      userZoomingEnabled: true,
      userPanningEnabled: true,
    });

    cyRef.current.on("tap", "node", (evt) => onNodeClick?.(evt.target.id()));
    cyRef.current.on("tap", "edge", (evt) => onEdgeClick?.(evt.target.data("row_id")));

    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [nodes, edges, cycles, onNodeClick, onEdgeClick]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px]" />;
}
