# MuleGuard Local

Fully offline, explainable, formula-driven Mule-Account Detection System.

Built from raw bank statements (PDF/CSV/XLSX), MuleGuard Local detects mule accounts, circular/layered fund flows, and produces a transparent, provable risk assessment — all without any internet connection, API keys, or cloud services.

## Quick Start

```bash
# One-command setup (Docker)
./setup.sh

# Or on Windows PowerShell
.\setup.ps1

# MuleGuard is ready at http://localhost:8000
```

## Architecture

```
Frontend (React + TypeScript + Tailwind)
    ↕ REST API (localhost only)
Backend (FastAPI + Python 3.11)
    ├─ Ingestion & OOD Guardrail
    ├─ Statement Understanding Engine
    ├─ Extraction Validator
    ├─ Transaction Categorization
    ├─ Feature Engineering (deterministic)
    ├─ Graph + Cycle Detection (Tarjan + Johnson)
    ├─ Risk Scoring (rules + anomaly + optional supervised)
    ├─ Evidence Bundle Assembly
    └─ LLM Narrative Layer (Ollama)
    ↕
Local DB (SQLite)    Ollama (localhost:11434)
```

## Key Principles

1. **Nothing is ever computed by a language model.** Every score, flag, and metric is the output of a deterministic function you can re-run by hand.
2. **100% offline.** No API keys, no cloud calls, no telemetry. Safe to run on an air-gapped machine.
3. **Every red flag must be provable.** Traceable to specific transaction rows, with exact formulas and thresholds.

## Detection Layers

| Layer | Method | Requires Labels? |
|-------|--------|-----------------|
| 1 — Deterministic Rules | YAML-configured if-then rules (retention, structuring, cycles, etc.) | No |
| 2 — Unsupervised Anomaly | Isolation Forest + robust MAD z-score | No |
| 3 — Optional Supervised | CatBoost/LightGBM (gated at 200+ labeled accounts) | Yes |

### Three-Tier Decision

- **CONFIRMED SUSPICIOUS** — fused score ≥ 75, at least one rule triggered, high extraction confidence
- **REVIEW REQUIRED** — ambiguous, ranked for human investigation
- **LIKELY LEGITIMATE** — fused score ≤ 25, low anomaly, high confidence

## Circular Flow Detection

Uses Tarjan's SCC (O(V+E)) to filter candidate cyclic regions, then Johnson's algorithm for bounded elementary cycle enumeration. Each detected cycle is scored on:
- Amount conservation ratio
- Velocity compression (hops/day)
- Cycle recurrence count

## Technology Stack

### Backend
- Python 3.11+ / FastAPI / Uvicorn
- Pydantic v2, SQLModel, SQLAlchemy
- pdfplumber, camelot-py, pypdfium2, pytesseract (OCR)
- networkx (graph analytics)
- scikit-learn (Isolation Forest, calibration)
- Optional: lightgbm, catboost (supervised layer)

### Frontend
- React 18 + TypeScript + Vite
- Tailwind CSS, Recharts, TanStack Table
- Cytoscape.js (interactive proof graph)
- Zustand (state management)
- All assets vendored locally — no CDNs

## Project Structure

```
muleguard-local/
├── docker-compose.yml        # Two-service Docker setup
├── config/                   # All thresholds, templates, prompts (user-editable)
│   ├── thresholds.yaml       # Every magic number — no hardcoded values in code
│   ├── category_rules.yaml   # Keyword→category mappings
│   ├── bank_templates/       # Known bank layout templates
│   └── llm_prompts/          # System prompts for Ollama
├── backend/                  # Python FastAPI application
│   ├── app/
│   │   ├── api/              # REST endpoints
│   │   ├── ingestion/        # File parsing (PDF/CSV/XLSX/OCR)
│   │   ├── understanding/    # Column mapping, template matching
│   │   ├── validation/       # Balance reconciliation, quality scoring
│   │   ├── categorization/   # Channel inference, counterparty extraction
│   │   ├── features/         # Deterministic feature engineering
│   │   ├── graph/            # Transaction graph + cycle detection
│   │   ├── scoring/          # Rule/anomaly/supervised scoring + fusion
│   │   ├── evidence/         # Evidence bundle assembly
│   │   ├── llm/              # Ollama client + fact-checker
│   │   ├── guardrails/       # Privacy, determinism, OOD enforcement
│   │   └── db/               # SQLite models and session
│   └── tests/                # pytest test suite
├── frontend/                 # React SPA
│   └── src/
│       ├── pages/            # 5 application pages
│       ├── components/       # Reusable UI components
│       └── lib/              # API client
└── data/                     # User data (gitignored)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/statements/upload` | Upload bank statements (PDF/CSV/XLSX) |
| GET | `/api/statements/{id}/preview` | Preview with detected column mapping |
| POST | `/api/statements/{id}/mapping` | Manual column mapping override |
| POST | `/api/statements/{id}/confirm` | Confirm extraction, trigger scoring |
| GET | `/api/statements/{id}/evidence` | Full evidence bundle JSON |
| GET | `/api/statements/{id}/transactions` | Paginated transaction table |
| GET | `/api/statements/{id}/graph` | Graph nodes/edges + detected cycles |
| GET | `/api/statements/{id}/narrative` | AI or template-based narrative |
| POST | `/api/batch/merge` | Merge multiple statements into one graph |
| GET | `/api/config/thresholds` | Read current thresholds |
| PUT | `/api/config/thresholds` | Update thresholds |
| GET | `/api/health` | Health check |
| GET | `/api/health/offline-check` | Offline self-test |

## Limitations

- **Single-statement mode** cannot prove multi-hop external cycles across unrelated accounts — true cross-account circular flow detection requires uploading multiple related statements.
- **This is a decision-support tool.** All outputs require human review before any account action is taken.
- **Local performance metrics** (precision, recall) are only meaningful once sufficient local investigator-confirmed labels accumulate — the tool will honestly report "not enough data" before that point.
- The tool **does not** access any external database, watchlist, or network resource unless the user explicitly supplies a local watchlist file.

## License

Internal use. Not for redistribution.
