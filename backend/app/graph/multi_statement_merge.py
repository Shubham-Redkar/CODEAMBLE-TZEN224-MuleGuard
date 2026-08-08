from typing import Any

import networkx as nx
import pandas as pd

from app.graph.graph_builder import build_transaction_graph


def merge_graphs(graphs: list[nx.MultiDiGraph], merge_threshold: float = 0.92) -> nx.MultiDiGraph:
    merged = nx.MultiDiGraph()

    for G in graphs:
        for n, data in G.nodes(data=True):
            if not merged.has_node(n):
                merged.add_node(n, **data)
            else:
                existing = merged.nodes[n]
                existing["flow"] = existing.get("flow", 0) + data.get("flow", 0)

        for u, v, k, data in G.edges(keys=True, data=True):
            merged.add_edge(u, v, **data)

    return merged


def merge_transaction_dfs(dfs: list[pd.DataFrame]) -> pd.DataFrame:
    return pd.concat(dfs, ignore_index=True)
