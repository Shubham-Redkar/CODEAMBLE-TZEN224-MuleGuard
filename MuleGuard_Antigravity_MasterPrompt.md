# MASTER BUILD PROMPT — "MuleGuard Local" 
### A fully offline, explainable, formula-driven Mule-Account Detection System built from raw bank statements (PDF/CSV)

---

## 0. HOW TO USE THIS DOCUMENT (READ THIS FIRST, ANTIGRAVITY)

You are being asked to build a **complete, production-grade software system from an empty repository**. This document is your single source of truth. Treat every numbered section as a binding requirement, not a suggestion. Where a design decision is left open, a **default decision is already made for you** — do not stop to ask the user unless something is genuinely ambiguous or physically impossible on their machine.

Work in the phases defined in **Section 22**. At the end of each phase, self-check against the **Definition of Done** checklist for that phase before moving to the next one. Do not skip the guardrail, validation, or explainability work to "get to the demo faster" — those ARE the product. A mule-detection tool that cannot prove *why* it flagged an account is worthless to a bank, and worse, actively harmful, because it will get innocent people's accounts frozen without cause.

Three sentences that must live in your head for the entire build:

1. **Nothing is ever computed by a language model.** Every score, every flag, every number on screen is the output of a deterministic function you can point to in the code and re-run by hand with a calculator. The LLM is a stenographer, never an analyst.
2. **The system never sees the internet after setup.** No API keys, no cloud calls, no telemetry, no "phone home." Bank statements contain PII and financial data — this tool must be safe to run on an air-gapped machine.
3. **Every red flag must be provable, traceable to specific transaction rows, and explained in plain language with the exact formula and threshold that fired.** If you can't show your work, the flag does not get raised.

---

## 1. MISSION STATEMENT

Build **MuleGuard Local**: a self-hosted application that ingests one or more bank account statements (PDF or CSV, in *any* Indian/international retail-bank export format), automatically understands and normalizes their structure regardless of template, extracts every transaction with verified accuracy, engineers a rich set of deterministic behavioral/network features, runs those features through a transparent multi-layer detection engine (rules + graph analytics + unsupervised statistics + optional supervised model when enough labeled history exists), detects **circular / layered fund flows** via graph-cycle analysis, computes a calibrated **Mule Risk Score** with a three-tier decision (Confirmed Legitimate / Review Required / Confirmed Suspicious — never a blind binary), and presents the entire case to an investigator through a dashboard that shows **every metric, every triggered rule, every contributing transaction, and an interactive transaction-flow graph**, with a locally-run LLM (via Ollama) used **only** to turn the already-computed evidence into a readable narrative — never to decide, score, or guess anything.

---

## 2. NON-NEGOTIABLE CORE PRINCIPLES (GUARDRAILS — GLOBAL)

These apply to every module in this document. If any instruction later in this file appears to conflict with these, these principles win.

### 2.1 Privacy / Data-locality guardrail
- The application MUST run 100% locally: local web server, local database (SQLite/DuckDB — see Section 19), local file storage, local inference (Ollama).
- **No API keys anywhere in the codebase.** Grep the repo before every commit for `sk-`, `api_key`, `Authorization: Bearer`, `openai`, `anthropic`, `.env` containing external endpoints. There should be zero results.
- No outbound network calls at runtime. Build a **network egress test**: a CI/test step that runs the backend inside a container with `network_mode: none` (except the loopback to Ollama) and asserts the app still starts and processes a sample statement successfully. See Section 20 (Deployment) for the exact `docker-compose.yml` shape.
- Uploaded statements and all derivative data (parsed transactions, scores, graphs) are written only to a local, user-controlled data directory (default `./data/`), never to a temp directory that might sync to cloud backup tools. Provide a "Purge all data" button that securely deletes it.
- No third-party analytics SDKs, no crash reporters, no font/script CDNs in the frontend — vendor every JS/CSS asset locally (see Section 18).

### 2.2 Determinism guardrail — "the LLM calculates nothing"
- Every numeric value shown anywhere in the UI (a score, a percentage, a count, a ratio, a graph metric) MUST originate from a named, unit-tested Python function with an explicit formula, not from a prompt to a language model.
- The Ollama model receives a **fully computed, already-final JSON evidence bundle** and is only allowed to paraphrase it into prose. It is architecturally **not given the raw transactions and not given permission to produce new numbers.** Section 15 defines the exact contract and a post-generation fact-checker that rejects any LLM output containing a number not present in the input JSON.
- No random seeds left unset. Any stochastic component (e.g., Isolation Forest) must be initialized with a fixed `random_state` and this must be stated in the evidence bundle for reproducibility ("this model is deterministic given the same input and seed=42").
- No "confidence" number is ever invented. Confidence/probability values must come from a calibrated model (Platt/isotonic — Section 11) or from an explicit, documented heuristic formula — never a bare LLM-guessed percentage.

### 2.3 Out-of-domain (OOD) / scope guardrail
- The system's *only* valid input is a bank account statement belonging to a single account, for a single account-holder, over a contiguous date range. It must actively **detect and refuse** anything else: invoices, receipts, resumes, random spreadsheets, credit card statements formatted totally differently (route to a dedicated card-statement path or reject with a clear message), scanned non-financial documents, or synthetic/garbage CSVs.
- This refusal must be evidence-based (Section 6.4 defines the exact OOD score), never "the LLM felt like this wasn't a bank statement."
- The system must never enrich or cross-reference an uploaded statement with any external dataset, watchlist, or "other than the statement" data source, online or offline-bundled, unless the user explicitly loads a **local, user-supplied** watchlist file (Section 8.6 — this is optional and off by default). This keeps every decision traceable purely to what the user uploaded, avoiding hidden bias or unverifiable third-party data.

### 2.4 Explainability / "prove every point" guardrail
- Every account-level flag must be backed by an **Evidence Bundle** (Section 13) that a human investigator (with zero ML background) can read and independently verify against the transaction table.
- Every transaction that contributes to a flag must be tagged and highlighted in the UI and in the proof graph (Section 17).
- No flag may be based on a single opaque model score alone — it must always be accompanied by the underlying rule triggers, feature values, and thresholds.

### 2.5 Accuracy-of-understanding guardrail (extraction correctness)
- Because different banks format statements wildly differently, the system must never assume a fixed column layout. It must **detect** the layout, **map** it to a canonical schema, and then **self-verify** its own extraction using the running-balance arithmetic check (Section 7.6) before anything downstream is allowed to run. If self-verification fails, the extraction is flagged as LOW CONFIDENCE and routed to a manual column-mapping screen — never silently trusted.

---

## 3. HIGH-LEVEL ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React SPA)                        │
│  Upload → Extraction Review → Dashboard → Evidence Explorer → Graph    │
└───────────────▲───────────────────────────────────────────┬───────────┘
                 │ REST (localhost only)                      │
┌────────────────┴───────────────────────────────────────────▼───────────┐
│                         BACKEND (FastAPI, Python)                      │
│                                                                          │
│  [A] Intake & OOD Guardrail                                             │
│  [B] Statement Understanding Engine (template detect + column mapping)  │
│  [C] Extraction Validator / Reconciliation Engine                       │
│  [D] Transaction Categorization Engine                                  │
│  [E] Feature Engineering Engine (deterministic formulas)                │
│  [F] Graph Construction + Circular-Flow Detection Engine                │
│  [G] Mule Risk Scoring Engine (rules + unsupervised + optional GBDT)    │
│  [H] Proof / Evidence-Bundle Engine                                     │
│  [I] Local LLM Narrative Layer (Ollama client + fact-checker)           │
│  [J] Guardrail Middleware (global, wraps every request)                 │
│                                                                          │
└───────────────┬───────────────────────────────────────────┬───────────┘
                 │                                            │
       ┌─────────▼─────────┐                        ┌─────────▼─────────┐
       │  Local DB (SQLite/  │                        │  Ollama (localhost │
       │  DuckDB) — data/    │                        │  :11434, no cloud) │
       └────────────────────┘                        └────────────────────┘
```

Everything below the frontend runs on the user's machine. There is no server component that isn't Dockerized locally.

---

## 4. TECHNOLOGY STACK (use exactly this unless a library is unavailable on the target OS — then pick the closest offline equivalent and document why)

### Backend
- **Language**: Python 3.11+
- **API framework**: FastAPI + Uvicorn
- **Data models / validation**: Pydantic v2 (strict mode everywhere — no silent type coercion)
- **PDF table/text extraction**: `pdfplumber` (primary), `camelot-py[cv]` (fallback for ruled tables), `pypdfium2` for rendering pages to images
- **Scanned PDF / image OCR**: `pytesseract` (Tesseract OCR, fully offline) as default; document that `PaddleOCR` is a drop-in alternative if the user needs better multilingual OCR — both run 100% locally
- **CSV/Excel parsing**: `pandas`, `openpyxl`, Python's built-in `csv` with sniffing (`csv.Sniffer`) for delimiter/encoding detection; `chardet`/`charset-normalizer` for encoding detection (many Indian bank exports are not UTF-8)
- **Fuzzy text matching** (merchant/category matching, template matching): `rapidfuzz`
- **Graph analytics**: `networkx` (cycle detection, SCC, centrality)
- **Statistics / unsupervised ML**: `numpy`, `scipy`, `scikit-learn` (`IsolationForest`, `LocalOutlierFactor`, `RobustScaler`, `IsotonicRegression`, `CalibratedClassifierCV`)
- **Optional supervised layer** (only unlocked once enough labeled accounts exist — Section 11.4): `lightgbm` and/or `catboost`
- **LLM runtime**: `ollama` Python client, talking to a locally running `ollama serve` (default port 11434). No other inference backend.
- **DB**: SQLite via `sqlmodel`/`SQLAlchemy` for transactional data; optionally `duckdb` for fast analytical feature computation over large transaction sets (multi-year statements). Both are embedded, file-based, zero network.
- **Testing**: `pytest`, `pytest-cov`, `hypothesis` for property-based tests on the parsers (Section 21)
- **Packaging**: `uv` or `poetry` for dependency locking (pin every version — reproducibility matters for an audit tool)

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (vendored locally, no CDN import)
- **Charts/metrics**: Recharts (bar/line/area charts for account activity, monthly flow, category breakdown)
- **Graph visualization** (the "proof graph"): `react-force-graph` (canvas/WebGL force-directed graph) or `Cytoscape.js` with the `cytoscape-react` wrapper — prefer Cytoscape.js because it has built-in support for highlighting cycles/paths and exporting the graph as an image for investigator reports
- **Tables**: TanStack Table (virtualized, handles thousands of transaction rows without lag)
- **State management**: Zustand (lightweight, no need for Redux boilerplate)
- **All npm packages vendored via local `node_modules`; production build is a static bundle served by the FastAPI backend itself** — so the end product is literally one process to start, no separate frontend server needed in production mode.

### Infra
- **Docker Compose** with two services: `backend` (bundles the built frontend + FastAPI + Ollama client) and `ollama` (official `ollama/ollama` image, model pulled once at build time, volume-mounted so it persists offline afterward).
- **No `ports` published beyond `127.0.0.1`** — bind everything to localhost, not `0.0.0.0`, unless the user explicitly opts into LAN access for a shared investigator workstation.

---

## 5. REPOSITORY STRUCTURE

```
muleguard-local/
├── docker-compose.yml
├── README.md
├── .env.example                     # only local, non-secret config (ports, thresholds file path)
├── data/                            # gitignored — all user data lives here, nowhere else
│   ├── uploads/
│   ├── db/muleguard.sqlite
│   └── exports/
├── config/
│   ├── thresholds.yaml              # every magic number in the system lives here, human-editable
│   ├── bank_templates/              # JSON template registry, one file per known bank layout
│   │   ├── generic_fallback.json
│   │   ├── sbi_savings_v1.json
│   │   ├── hdfc_savings_v1.json
│   │   ├── icici_savings_v1.json
│   │   └── ...
│   ├── category_rules.yaml          # keyword/regex → category mapping, user-editable
│   └── llm_prompts/
│       ├── system_prompt_summary.txt
│       └── evidence_to_prose_template.txt
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py                  # FastAPI app entrypoint
│   │   ├── api/
│   │   │   ├── routes_upload.py
│   │   │   ├── routes_review.py
│   │   │   ├── routes_analysis.py
│   │   │   ├── routes_graph.py
│   │   │   ├── routes_report.py
│   │   │   └── routes_health.py     # includes an explicit "is_offline" self-check endpoint
│   │   ├── guardrails/
│   │   │   ├── ood_detector.py
│   │   │   ├── privacy_guard.py     # middleware asserting no outbound calls, no PII in logs
│   │   │   └── determinism_guard.py # decorator enforcing fixed seeds + pure-function contracts
│   │   ├── ingestion/
│   │   │   ├── file_router.py       # PDF vs CSV vs XLSX dispatch
│   │   │   ├── pdf_extractor.py
│   │   │   ├── ocr_fallback.py
│   │   │   ├── csv_extractor.py
│   │   │   └── encoding_detect.py
│   │   ├── understanding/
│   │   │   ├── template_matcher.py  # matches statement structure to config/bank_templates/*
│   │   │   ├── header_classifier.py # heuristic + fuzzy header→canonical column mapping
│   │   │   ├── column_mapper.py
│   │   │   └── canonical_schema.py  # pydantic models: RawRow, CanonicalTransaction
│   │   ├── validation/
│   │   │   ├── reconciliation.py    # running-balance self-check
│   │   │   ├── quality_score.py
│   │   │   └── manual_mapping_api.py
│   │   ├── categorization/
│   │   │   ├── rule_engine.py
│   │   │   ├── counterparty_extractor.py  # regex/NER-lite on narration strings
│   │   │   └── merchant_normalizer.py
│   │   ├── features/
│   │   │   ├── lifecycle_features.py
│   │   │   ├── identity_proxy_features.py
│   │   │   ├── behavior_features.py
│   │   │   ├── velocity_features.py
│   │   │   ├── structuring_features.py
│   │   │   └── feature_registry.py  # single source of truth: name → function → formula docstring
│   │   ├── graph/
│   │   │   ├── graph_builder.py
│   │   │   ├── cycle_detector.py    # Tarjan SCC + Johnson's simple_cycles
│   │   │   ├── centrality.py
│   │   │   └── multi_statement_merge.py
│   │   ├── scoring/
│   │   │   ├── rule_scorer.py
│   │   │   ├── anomaly_scorer.py    # Isolation Forest / robust z-score ensemble
│   │   │   ├── supervised_scorer.py # optional GBDT, gated behind data-availability check
│   │   │   ├── calibration.py
│   │   │   ├── fusion.py            # weighted evidence fusion → final tier decision
│   │   │   └── decision_policy.py   # exact three-tier threshold logic (Section 12.6)
│   │   ├── evidence/
│   │   │   ├── evidence_bundle.py
│   │   │   └── evidence_schema.py
│   │   ├── llm/
│   │   │   ├── ollama_client.py
│   │   │   ├── narrative_generator.py
│   │   │   └── fact_checker.py      # rejects hallucinated numbers
│   │   ├── db/
│   │   │   ├── models.py
│   │   │   └── session.py
│   │   └── config_loader.py
│   └── tests/
│       ├── test_pdf_extraction.py
│       ├── test_csv_extraction.py
│       ├── test_reconciliation.py
│       ├── test_ood_detector.py
│       ├── test_features.py
│       ├── test_cycle_detection.py
│       ├── test_scoring_determinism.py
│       ├── test_fact_checker.py
│       └── fixtures/
│           ├── sample_statements/   # synthetic, non-real statements for every supported bank layout
│           └── synthetic_mule_cases/ # hand-crafted ground truth cases (Section 21.3)
└── frontend/
    ├── package.json
    ├── src/
    │   ├── pages/
    │   │   ├── UploadPage.tsx
    │   │   ├── ExtractionReviewPage.tsx
    │   │   ├── DashboardPage.tsx
    │   │   ├── EvidenceExplorerPage.tsx
    │   │   └── ProofGraphPage.tsx
    │   ├── components/
    │   │   ├── MetricCard.tsx
    │   │   ├── RiskGauge.tsx
    │   │   ├── TransactionTable.tsx
    │   │   ├── RuleTriggerList.tsx
    │   │   ├── ProofGraphCanvas.tsx
    │   │   └── NarrativePanel.tsx
    │   └── lib/api.ts
    └── vite.config.ts
```

---

## 6. MODULE A — INPUT INTAKE & OOD GUARDRAIL

### 6.1 Accepted inputs
- PDF (native text-layer or scanned/image-based)
- CSV
- XLSX/XLS (many banks export Excel, not CSV — support it via `openpyxl`)
- Reject everything else (`.docx`, `.txt`, `.json`, images alone, etc.) at the API boundary with HTTP 415 and a clear message.

### 6.2 Multi-file / batch mode
- Allow uploading **multiple statements at once** (e.g., statements from several accounts under investigation, or multiple months of the same account). This directly enables:
  - Multi-hop **cross-account circular flow detection** (Section 10), which is impossible from a single statement alone.
  - The optional supervised learning track (Section 11.4), which needs many labeled accounts.
- Each file is processed independently through Modules B/C/D/E, then merged at the graph layer (Section 10.5) and portfolio layer (Section 11.4).

### 6.3 File-level sanity gate (before any parsing)
Before attempting extraction, run cheap, fast checks and reject obviously-wrong files immediately:
- File size sanity (reject 0-byte files, reject absurdly large files beyond a configurable cap, default 50MB).
- MIME/magic-byte check matches the stated extension.
- For PDFs: page count > 0, at least one page contains extractable text OR is image-based (route to OCR).
- For CSV/XLSX: at least 2 rows and at least 3 columns after sniffing.

### 6.4 The OOD (out-of-domain) Statement-Likelihood Score
This is the **core anti-garbage-in guardrail**. Before any transaction is trusted, compute a deterministic `statement_likelihood_score` in `[0,1]` from structural evidence — never from an LLM's opinion.

Signals (each boolean/scalar, computed by simple regex/heuristics over the extracted raw text/columns):

| Signal | How computed | Weight |
|---|---|---|
| `has_date_column` | A column where ≥80% of values parse as valid dates in a consistent format | 0.20 |
| `has_amount_columns` | At least one/two columns where ≥80% of values parse as currency/decimal numbers | 0.20 |
| `has_running_balance_column` | A numeric column that is monotonically explainable via `balance[t] = balance[t-1] ± amount[t]` for a sample of rows (see 7.6) | 0.20 |
| `has_bank_identity_markers` | Regex hits for IFSC code pattern (`^[A-Z]{4}0[A-Z0-9]{6}$`), account number pattern, "Statement of Account", "IFSC", "MICR", "Branch", currency symbols (₹, INR, $, etc.) | 0.15 |
| `has_narration_column` | A free-text column with realistic transaction-narration entropy (not literally a single repeated word) | 0.15 |
| `row_count_plausible` | Between a configurable min (e.g. 3) and max (e.g. 200,000) rows | 0.10 |

`statement_likelihood_score = Σ(weight_i × signal_i)`, each `signal_i ∈ [0,1]` (booleans are 0/1, the balance-consistency one is the fraction of rows that reconcile).

**Decision rule** (thresholds in `config/thresholds.yaml`, defaults shown):
- `score ≥ 0.70` → proceed automatically.
- `0.40 ≤ score < 0.70` → proceed but show a prominent "Low-confidence: please confirm this is a bank statement and review the column mapping" banner, and force the user through the manual column-mapping screen (Section 7.5) before analysis unlocks.
- `score < 0.40` → **hard reject**. Show the user exactly which signals failed (e.g., "No column matched a running balance pattern; no IFSC/account-number pattern found") so it's provable, not a black-box refusal.

This score, its component signals, and the pass/fail reasoning are stored and shown in the Evidence Bundle (Section 13) — the user should be able to see exactly why the tool accepted or rejected their file.

---

## 7. MODULE B/C — STATEMENT UNDERSTANDING & EXTRACTION-VALIDATION ENGINE

This is the single most important module for trust: **column extraction must be verifiably correct**, not merely "probably right."

### 7.1 Canonical transaction schema (the target of every extraction, no matter the source bank)

```python
class CanonicalTransaction(BaseModel):
    row_id: str                 # stable synthetic id, e.g. "{statement_id}-{row_index}"
    txn_date: date
    value_date: Optional[date]
    narration: str              # raw description text, untouched
    reference_no: Optional[str]
    debit_amount: Optional[Decimal]     # money OUT of the account
    credit_amount: Optional[Decimal]    # money INTO the account
    balance_after: Optional[Decimal]    # running balance stated on the statement, if present
    channel: Optional[str]      # NEFT/RTGS/IMPS/UPI/ATM/POS/CHEQUE/CASH/etc, inferred (Section 9)
    counterparty_raw: Optional[str]     # extracted candidate counterparty name/UPI-id/account
    source_row_confidence: float        # 0-1, per-row extraction confidence (7.7)
```

### 7.2 PDF extraction pipeline
1. Try `pdfplumber` table extraction on every page (`page.extract_tables()` with multiple strategies: lines-based, text-based). Keep the strategy that yields the most rows with consistent column counts.
2. If `pdfplumber` yields poor results (few/no tables, ragged column counts), fall back to `camelot` (`flavor="lattice"` then `"stream"`).
3. If the PDF has no extractable text layer at all (scanned image), rasterize pages with `pypdfium2`, run `pytesseract` OCR with `--psm 6` (assume uniform block of text) tuned per page, then apply the same table-structuring heuristics on the OCR'd text using consistent whitespace/column-alignment detection.
4. Concatenate tables across pages, dropping repeated header rows (detect repeated header text on every page and strip duplicates after the first).
5. Output: a raw 2-D string grid per file, handed to the Header Classifier (7.4).

### 7.3 CSV/XLSX extraction pipeline
1. Detect encoding (`charset-normalizer`) — Indian bank exports are frequently `cp1252` or `latin-1`, not UTF-8. Never assume UTF-8 blindly.
2. Detect delimiter via `csv.Sniffer`; if it fails, try `,`, `;`, `\t`, `|` in that order and keep whichever produces the most consistent column count across rows.
3. Detect and skip preamble rows (many bank exports have 5-15 metadata rows — "Account Holder Name:", "Statement Period:" — before the real header row). Heuristic: the real header row is the first row where ≥3 cells match known header keywords (Section 7.4) or the first row after which every subsequent row has a stable column count and at least one column is consistently numeric.
4. Detect and strip footer/summary rows similarly (e.g., "Total", "Closing Balance", disclaimer text blocks).

### 7.4 Header classification → canonical column mapping (template-aware + fallback)
Two-tier strategy, always attempted in this order:

**Tier 1 — Known template match.** Compare the detected header row (and general shape: column count, order, characteristic footer text) against the JSON registry in `config/bank_templates/`. Each template file looks like:

```json
{
  "template_id": "hdfc_savings_v1",
  "match_headers": ["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
  "match_threshold": 0.85,
  "column_map": {
    "Date": "txn_date",
    "Narration": "narration",
    "Chq./Ref.No.": "reference_no",
    "Value Dt": "value_date",
    "Withdrawal Amt.": "debit_amount",
    "Deposit Amt.": "credit_amount",
    "Closing Balance": "balance_after"
  },
  "date_format": "%d/%m/%y",
  "decimal_style": "comma_thousands"
}
```
Matching uses `rapidfuzz.fuzz.token_sort_ratio` between each detected header cell and each template's `match_headers` list; a template matches if the mean best-match ratio across all its declared headers exceeds `match_threshold`.

**Tier 2 — Generic fallback heuristic classifier** (used when no template matches well, and the trigger for building a *new* template — Section 7.8). For every detected column, compute a keyword+content score against each canonical field:

| Canonical field | Header keyword hints (fuzzy-matched) | Content heuristic |
|---|---|---|
| `txn_date` | "date", "txn date", "transaction date", "value date" | ≥80% of values parse as a date |
| `narration` | "narration", "description", "particulars", "details", "remarks" | High text entropy, avg length > 10 chars |
| `debit_amount` | "debit", "withdrawal", "dr", "amount debited" | ≥70% numeric, values generally reduce balance |
| `credit_amount` | "credit", "deposit", "cr", "amount credited" | ≥70% numeric, values generally increase balance |
| `balance_after` | "balance", "closing balance", "running balance" | Numeric, and passes the reconciliation check (7.6) |
| `reference_no` | "ref", "cheque no", "chq/ref", "transaction id" | Alphanumeric, high uniqueness ratio |
| `single_amount_signed` (some banks use ONE amount column + a separate Dr/Cr indicator column) | "amount" + a nearby "type"/"dr/cr" column | Detected as a pair; split into debit/credit downstream |

Assign each column to the canonical field with the highest combined score (`0.5 × header_score + 0.5 × content_score`), with a minimum acceptance threshold (default 0.55) below which the field is left unmapped and the user is prompted (7.5).

### 7.5 Manual mapping fallback UI (never silently guess past the confidence floor)
If any *required* canonical field (`txn_date`, and at least one of `debit_amount`/`credit_amount`) cannot be mapped with sufficient confidence, or if the OOD/reconciliation score is low, the frontend must show an **Extraction Review screen**: the first 20 raw rows in a grid, with dropdowns above each column letting the user manually assign it to a canonical field or mark it "ignore." This mapping, once confirmed, is offered back to the user as **"Save as new template"** (Section 7.8) so the tool gets smarter per bank over time — entirely locally, no cloud sync.

### 7.6 Self-verification: the running-balance reconciliation check (the accuracy proof)
This is how the system **proves to itself** that extraction was correct, independent of any human review.

For each statement, after mapping, sort rows by `txn_date` (and by original row order within the same date), then for every row `t` where `balance_after` exists:

```
expected_balance[t] = balance_after[t-1] - debit_amount[t] + credit_amount[t]
row_reconciled[t] = abs(expected_balance[t] - balance_after[t]) <= tolerance   # tolerance default 0.01 currency unit
```

Compute:
```
reconciliation_rate = (# rows reconciled) / (# rows with a balance_after value)
```

- `reconciliation_rate ≥ 0.98` → **HIGH extraction confidence**. Proceed automatically.
- `0.85 ≤ reconciliation_rate < 0.98` → **MEDIUM confidence**. Proceed, but flag the specific unreconciled rows in the UI as "extraction uncertain — verify manually" (they are still shown, just visually marked, and excluded from feeding the most sensitive velocity features until confirmed).
- `reconciliation_rate < 0.85` → **LOW confidence**. Block automatic analysis; force the Extraction Review screen; suggest re-parsing with the OCR fallback or a different table-extraction strategy; if the statement genuinely has no balance column, use a relaxed check instead (debit/credit totals summed per month should be internally consistent, and warn the user this statement type has weaker self-verification).

This reconciliation rate is stored permanently as `extraction_confidence` on the statement record and is displayed everywhere the statement's data is used downstream — every score in the app should be traceably qualified by "based on a statement extracted with 99.4% verified accuracy," not presented as unconditionally true.

### 7.7 Per-row confidence
`source_row_confidence` for each row = average of: (a) OCR confidence if OCR was used (Tesseract returns per-word confidence — average it), (b) 1.0 if all required fields parsed cleanly with no fallback logic invoked, else a partial score, (c) 1.0 if the row participated in a reconciled balance check, else 0.5.

### 7.8 Template learning loop (fully local, no external data)
When a user confirms a manual mapping (7.5), serialize it into a new file under `config/bank_templates/user_learned/`, tagged with a hash of the header row so future uploads of the same bank format auto-match at Tier 1. This is purely local file persistence — never uploaded anywhere.

---

## 8. MODULE D — TRANSACTION CATEGORIZATION ENGINE

All categorization is **rule-based and deterministic** (regex/keyword/fuzzy-match against `config/category_rules.yaml`), never LLM-guessed, so results are stable and auditable.

### 8.1 Channel inference
Classify each transaction's `channel` from narration patterns:
- `UPI` — narration contains "UPI/", a VPA-like pattern (`[\w.\-]+@[\w]+`)
- `NEFT` / `RTGS` / `IMPS` — explicit tokens
- `ATM` — "ATM", "CASH WDL", "ATW"
- `POS` — "POS", merchant terminal codes
- `CHEQUE` — "CHQ", cheque number patterns
- `INTEREST` / `CHARGES` / `REVERSAL` — bank-generated entries (important: exclude these from behavioral fraud features — they are not user-initiated fund movement)
- `INTERNAL_TRANSFER` — narration references the same account/holder name (self-transfer)
- `UNKNOWN` — fallback

### 8.2 Category assignment
A YAML-driven rule list, e.g.:
```yaml
categories:
  - name: "salary"
    match_any: ["salary", "sal credit", "payroll"]
    direction: credit
  - name: "utility_bill"
    match_any: ["electricity", "recharge", "broadband", "dth"]
    direction: debit
  - name: "peer_transfer"
    match_any: ["upi", "neft", "imps"]
    direction: any
  - name: "cash"
    match_any: ["atm", "cash"]
    direction: debit
```
Fuzzy fallback: if no exact keyword hits, use `rapidfuzz` against the category keyword list with a similarity floor (default 80) before assigning `"uncategorized"`.

### 8.3 Counterparty extraction (deterministic regex/heuristic, not NER-model guessing)
From `narration`, extract a normalized `counterparty_raw` candidate using an ordered set of regex patterns tuned to common Indian bank narration formats, e.g.:
- UPI: `UPI/(?:P2A|P2M)?/?\d*/([A-Za-z0-9. ]+)/` → capture group is the counterparty name/VPA
- NEFT/IMPS: `(?:NEFT|IMPS)[-/]([A-Z0-9]+)[-/]([A-Za-z .]+)` → capture bank ref + name
- Generic fallback: strip known boilerplate tokens (bank codes, dates, reference numbers) and keep the longest remaining alphabetic run as a best-effort candidate, tagged with lower confidence.

### 8.4 Merchant/counterparty normalization
Normalize case, strip punctuation/extra whitespace, collapse common suffix noise ("PVT LTD", "LIMITED") for grouping purposes, then cluster near-duplicate counterparty strings using `rapidfuzz` token-set ratio ≥ 90 into a single canonical counterparty ID — this is what lets the graph engine (Section 10) correctly recognize "the same counterparty" even when narration formatting varies slightly transaction to transaction.

### 8.5 Self-transfer detection
Flag transactions where the counterparty name fuzzy-matches the account holder's own name (if known from statement header) — these should generally be excluded from "external circular flow" scoring since they are the customer moving their own money.

### 8.6 Optional local watchlist match (off by default, user-supplied only)
If, and only if, the user explicitly loads a local CSV of known-bad identifiers (their own compliance list — never bundled or downloaded by MuleGuard), match `counterparty_raw`/account numbers against it and surface a corroborative (not decisive) flag. This respects the "no external data" principle — it's the *user's own* data, staying local, used only if they opt in.

---

## 9. MODULE E — FEATURE ENGINEERING ENGINE (every formula explicit — nothing learned, nothing guessed)

All features are computed per account (aggregated over the statement period) with a **docstring in the code that states the exact formula**, and every feature registers itself in `feature_registry.py` with `{name, formula_text, rationale, source_module}` so the Evidence Bundle can quote it verbatim.

### 9.1 Lifecycle features (from statement metadata + transaction dates)
- `account_age_days_observed` = `max(txn_date) - min(txn_date)` — the span actually covered by the uploaded data (not the true account age, which the tool doesn't know — labeled clearly as "observed window," never overclaimed as full account history).
- `dormancy_breaks`: count of gaps between consecutive transactions exceeding a configurable threshold (default 30 days) followed by a burst of ≥N transactions (default 3) within a short window (default 3 days) — a classic "dormant-then-burst" pattern.
- `first_week_activity_ratio` = (transaction count in the first 7 observed days) / (total transaction count) — abnormally high value suggests a new/rapidly-activated account used briefly then abandoned.
- `days_since_last_activity` at time of upload.

### 9.2 Behavioral / velocity features
- `net_retention_ratio` = `1 - (Σ debit_amount within 24h of a matching inbound credit) / (Σ credit_amount)`  — measures how much of incoming money is retained vs immediately pushed out. **Low retention = classic pass-through mule signature.**
- `median_holding_time_hours`: for each credit, find the time to the next debit that brings the balance back down toward pre-credit levels (a "matched outflow"); take the median across all matched pairs.
- `inflow_outflow_velocity` = (count of transactions in the busiest rolling 24-hour window) — a simple rolling-window max-count computation, not a guess.
- `turnover_ratio` = `(Σ debit_amount + Σ credit_amount) / average_daily_balance` — high turnover relative to typical balance held indicates pass-through use rather than genuine holding/savings behavior.
- `average_daily_balance`: computed properly by integrating `balance_after` over time (area under the balance curve / number of days), not a naive mean of statement snapshots.
- `weekend_night_activity_ratio`: fraction of transactions occurring outside typical banking hours (configurable window, default 22:00–06:00) or on weekends — only computable if the statement provides timestamps, not just dates; degrade gracefully (mark "unavailable") if only dates are present — **never fabricate a time**.

### 9.3 Structuring / smurfing features
- `near_threshold_ratio`: fraction of transactions whose amount falls within a configurable band just under a regulatory/reporting threshold (`config/thresholds.yaml`, e.g. 90–100% of ₹50,000 or ₹2,00,000 — thresholds are user-configurable per jurisdiction, never hardcoded blindly).
- `round_number_ratio`: fraction of transaction amounts that are suspiciously round (e.g., exact multiples of 1,000/10,000) — mules often move round-numbered sums.
- `benford_deviation_score`: chi-square statistic comparing the leading-digit distribution of transaction amounts to Benford's Law expected distribution — a well-established, fully deterministic statistical anomaly formula, **not a guess**:
  ```
  expected_p(d) = log10(1 + 1/d)   for d = 1..9
  chi_sq = Σ_d ( (observed_count(d) - expected_p(d)*N)^2 / (expected_p(d)*N) )
  ```
  High chi-square relative to its degrees-of-freedom critical value flags amount-distribution anomalies.
- `fan_in_score` / `fan_out_score`: number of *distinct* counterparties sending money in / receiving money out within a rolling window, normalized by transaction count — high fan-in with rapid fan-out is the textbook mule signature.

### 9.4 Identity/lifecycle-proxy features (only what's derivable from the statement itself — never claim KYC data the tool doesn't have)
- `name_consistency_flag`: does the account holder name on the statement header match across pages/parsed sections consistently? (Simple string-equality/fuzzy check — a mismatch may indicate a merged/corrupted document, itself worth flagging under the OOD/quality guardrail, not asserted as identity fraud.)
- `stated_vs_observed_purpose_deviation`: if the statement declares an account "type" (savings/current/salary), compare observed transaction category mix against the typical mix for that type (e.g., a "salary account" showing no recognizable salary-pattern credits) — implemented as a simple categorical-distribution distance (Section 9.6), fully transparent.

### 9.5 Network features (computed by the graph engine, Section 10, but registered here for completeness)
- `distinct_counterparty_count`
- `counterparty_concentration` (Herfindahl-Hirschman Index over counterparty transaction-value share: `Σ (share_i)^2`) — high concentration with a single dominant counterparty combined with high turnover is notable.
- `cycle_membership_count`, `cycle_conservation_score`, `max_cycle_amount` — from Section 10.

### 9.6 Distance/statistical helper functions (shared, deterministic)
- Population comparison uses **Jensen-Shannon divergence** or simple **L1 distance** between category-share histograms — cite the exact formula in code comments, no ML black box.
- All ratios are guarded against divide-by-zero (explicit `if denominator == 0: return None` — never silently return 0 or NaN into a score).

### 9.7 Feature registry contract
Every function in `features/*.py` MUST:
1. Take a `pandas.DataFrame` of `CanonicalTransaction` rows (+ metadata) as input.
2. Return a plain float/int/None plus a **formula string** and a **human explanation string**.
3. Be pure (no I/O, no randomness) so it is trivially unit-testable with hand-built fixtures where you *know* the correct answer in advance (Section 21.2).

---

## 10. MODULE F — GRAPH CONSTRUCTION & CIRCULAR FUND-FLOW DETECTION ENGINE

This directly answers the requirement: **"all circular fund flows should be detected."**

### 10.1 Graph model
- **Nodes** = canonical counterparty IDs (Section 8.4) **plus** the subject account itself as a node.
- **Edges** = individual transactions, directed from payer → payee, attributed with `{amount, timestamp, channel, row_id}` (a directed **multigraph**, since the same two parties can transact many times — use `networkx.MultiDiGraph`).
- In **single-statement mode**, the graph is necessarily a **star/ego-graph**: the subject account in the center, counterparties as leaves, so "cycles" mostly manifest as the account receiving from X and later paying X back, or receiving from X then paying a third party who is *also* known (from narration) to relate back to X — captured to the extent narration text reveals it. **Be explicit in the UI about this limitation**: true multi-hop A→B→C→A cycles across unrelated third-party accounts generally require **multiple statements** (batch mode).
- In **multi-statement / batch mode** (Section 6.2), merge all uploaded accounts' graphs into one combined graph keyed by normalized counterparty identity (account number / UPI ID / fuzzy-matched name) — this is where **true multi-hop circular flow detection becomes possible and powerful**, and should be the recommended mode whenever the user has more than one statement.

### 10.2 Cycle detection algorithm (exact algorithm selection, with justification)
Use a **two-stage funnel**, chosen specifically because raw cycle enumeration on a large graph is computationally explosive:

**Stage 1 — Strongly Connected Component (SCC) filter — Tarjan's Algorithm.**
Run `networkx.strongly_connected_components` (Tarjan's algorithm, O(V+E)) on the *directed* graph (collapsing the multigraph to a simple directed graph for this pass). Only components with more than one node (or with a self-loop) can possibly contain a cycle — this cheaply discards the vast majority of a large graph before expensive work.

**Stage 2 — Elementary cycle enumeration — Johnson's Algorithm, bounded.**
Within each SCC with size > 1, run `networkx.simple_cycles()` (Johnson's algorithm) to enumerate all elementary circuits, but **bound the search**:
- `max_cycle_length` (default 6 hops) — configurable; longer cycles are rare in practice and enumeration cost grows fast.
- If a component is pathologically dense (edge count above a configurable cap), skip full enumeration and instead report "large cycle-dense cluster detected, manual graph review recommended" rather than hanging — never silently truncate without telling the investigator.

**Why this pair of algorithms and not something else:** Tarjan's SCC is the standard linear-time way to find *candidate* cyclic regions in a directed graph; Johnson's algorithm is the standard, textbook-correct way to enumerate all elementary cycles once you know where to look, and it is exactly what `networkx` ships and what the referenced BIS/graph-analytics literature converges on for laundering-ring discovery. This is far cheaper and more explainable than a learned graph embedding model, and — critically — it produces an exact, provable list of transactions forming each cycle, which a black-box GNN cannot give you (this system needs **proof**, not just a suspicion score).

### 10.3 Circular-flow scoring (turns "a cycle exists" into "this cycle is suspicious")
For every detected elementary cycle `C = [n0 → n1 → ... → nk → n0]`, compute, **all deterministically**:

- `hop_count = len(C)`
- `cycle_span_days` = time between the first and last transaction timestamp in the cycle
- `amount_conservation_ratio` = `1 - abs(Σ outflow_along_cycle - Σ inflow_along_cycle) / max(Σ outflow_along_cycle, Σ inflow_along_cycle)` — a ratio near 1.0 means money that left roughly all came back (classic layering / wash pattern); a ratio near 0 means the "cycle" doesn't actually conserve value and is a weaker signal.
- `velocity_compression` = `hop_count / cycle_span_days` (cycles completing within hours/days are far more suspicious than ones spanning many months, which are more likely coincidental repeat business relationships).
- `cycle_recurrence_count`: how many times this same node-sequence (or a near-identical one) repeats across the observed window — recurring identical cycles are strong evidence of a deliberate, repeated layering script rather than a one-off.

**Composite cycle risk score** (weights configurable, defaults shown, all in `[0,1]` after min-max or logistic normalization defined explicitly in code, no ML fitting required):
```
cycle_risk = 0.35*amount_conservation_ratio
           + 0.30*normalize(velocity_compression)
           + 0.20*normalize(cycle_recurrence_count)
           + 0.15*normalize(1/hop_count)     # shorter, tighter cycles score higher
```

Every cycle above a configurable `cycle_risk` threshold (default 0.6) becomes its own **Cycle Evidence Item**, listing every contributing `row_id`, rendered directly on the Proof Graph (Section 17) as a highlighted closed loop.

### 10.4 Other network metrics (supporting evidence, not decisive alone)
- **Degree centrality, in/out-degree ratio** — an account that mostly receives from many and sends to few (or vice versa) is a classic "collector" or "disperser" node.
- **Betweenness centrality** (multi-statement mode) — flags accounts sitting *between* many flows, a hallmark of a relay/layering node.
- **PageRank-style flow-weighted centrality** — optional, only computed and shown in multi-statement/batch mode where the graph is large enough to be meaningful; explicitly suppressed on tiny single-account ego-graphs where it would be statistically meaningless (**guardrail: don't show a metric where the sample size makes it noise** — display "insufficient graph size for this metric" instead of a misleadingly precise number).

### 10.5 Multi-statement merge logic
When multiple statements are uploaded together, entity-resolve counterparties across files (same account number → same node; fuzzy name/UPI match above a high threshold, default 92, → same node, flagged as "probable match" vs "exact match" so investigators know the confidence of each merge). Re-run the full Stage-1/Stage-2 cycle detection on the merged graph — this is where cross-account laundering rings become visible and is the single most powerful capability of the system; document this clearly for the user as the recommended workflow when multiple related accounts are under investigation.

---

## 11. MODULE G — MULE RISK SCORING ENGINE (algorithm selection & full justification)

### 11.1 Why NOT a single supervised classifier as the primary method (contrary to a generic ML approach)
The three attached reference documents were written for a **hackathon setting with a large, pre-labeled dataset** (3,923 anonymized features, a known binary target, thousands of rows). **This deployment is different and must be treated differently**: the real-world input is typically **one (or a handful of) raw bank statement(s) with no ground-truth label**. There is no labeled peer population to train a supervised model on out of the box. Therefore:

- **Primary detection layer = deterministic rules + unsupervised statistics + graph analytics** (Sections 9, 10, and below) — these require zero labeled training data and are the correct choice for the actual problem this tool solves.
- **Secondary, optional supervised layer** unlocks automatically only once the user has accumulated enough investigator-confirmed outcomes locally (Section 11.4) to train responsibly — mirroring the hackathon docs' own finding (their Section/Finding on GBDT superiority on tabular data) but applied honestly to when labels actually exist.

This distinction must be **explicitly explained in the product itself** (a small "How does scoring work?" info panel) so the tool never overclaims it is running a trained fraud model when, on someone's very first upload, it can't possibly have one yet.

### 11.2 Layer 1 — Deterministic rule engine
A YAML-configured set of explicit if-then rules over the Section 9 features, each with a name, a plain-language description, a formula reference, and a point weight. Example entries in `config/thresholds.yaml`:
```yaml
rules:
  - id: "R1_low_retention_high_turnover"
    description: "Money moves through the account almost immediately after arriving, and the account turns over its balance many times relative to what it typically holds."
    condition: "net_retention_ratio < 0.15 AND turnover_ratio > 8"
    points: 25
  - id: "R2_dormancy_then_burst"
    description: "The account was inactive for an extended period and then suddenly received a burst of activity."
    condition: "dormancy_breaks >= 1"
    points: 15
  - id: "R3_structuring_near_threshold"
    description: "A large share of transactions sit just under a reporting threshold."
    condition: "near_threshold_ratio > 0.3"
    points: 20
  - id: "R4_benford_anomaly"
    description: "The distribution of transaction amounts deviates significantly from the naturally expected pattern (Benford's Law)."
    condition: "benford_deviation_score > critical_value_95"
    points: 10
  - id: "R5_circular_flow_detected"
    description: "One or more closed loops of fund movement were detected, where money that left the account (directly or via intermediaries) substantially returned."
    condition: "max_cycle_risk_score > 0.6"
    points: 30
  - id: "R6_fan_in_fan_out"
    description: "Many distinct parties sent money in, and funds were rapidly redistributed to few or many distinct parties out."
    condition: "fan_in_score > p90 AND net_retention_ratio < 0.2"
    points: 20
```
`rule_score = min(100, Σ points for every rule whose condition is TRUE)`. Every triggered rule is logged with its exact computed feature values into the Evidence Bundle — this alone, even with zero ML, already gives a fully explainable, provable flag list, satisfying the "prove every point" requirement even before any statistics layer runs.

### 11.3 Layer 2 — Unsupervised anomaly detection (no labels required, still fully deterministic given a fixed seed)
Because there's no labeled population, use **unsupervised outlier detection** to catch patterns the fixed rule list didn't anticipate, run against either (a) the account's own transaction-level feature vectors (intra-account anomaly — does this account's *own* behavior show an internal shift/anomaly over time?), and (b) — only in batch/multi-statement mode where there are enough accounts to form a population — cross-account anomaly (does this account look unusual *relative to the other uploaded accounts*?).

- **Algorithm**: `sklearn.ensemble.IsolationForest` (chosen because it is fast, needs no distributional assumptions, handles the mixed-scale features here well, and is the standard, well-understood baseline for this exact "detect novel misbehavior without labels" problem — explicitly called out as valuable in the reference documents' own architecture for "unknown-pattern protection").
  - Fixed `random_state=42`, `n_estimators=200`, `contamination="auto"` documented in code and in the Evidence Bundle for full reproducibility (**never leave this stochastic without a pinned seed** — Section 2.2).
- **Secondary, fully transparent statistical check**: robust z-score / Median Absolute Deviation (MAD) per feature: `modified_z = 0.6745*(x - median)/MAD`; flag `|modified_z| > 3.5` — this is the classic robust-outlier formula (Iglewicz & Hoyle), fully hand-computable, and used as a cross-check against the Isolation Forest so no single opaque model is the sole source of an anomaly claim.
- `anomaly_score = normalize(isolation_forest_score) ` reported alongside `which specific features drove the anomaly` (Isolation Forest path-length contribution per feature, or simply reporting which individual features exceeded the MAD threshold) — **never show a bare anomaly score with no attribution**.

### 11.4 Layer 3 — Optional supervised model (gated, only when responsibly trainable)
This layer mirrors the hackathon documents' well-justified recommendation (**gradient-boosted trees, not GNNs or deep nets, are state-of-the-art on flat tabular data** — Grinsztajn et al. 2022; Shwartz-Ziv & Armon 2022) but is **only activated when the local database has accumulated a minimum number of investigator-labeled outcomes** (default gate: ≥ 200 labeled accounts, both classes represented, configurable) — never trained on a handful of rows, and never silently substituted for Layers 1–2.

- **Primary model**: **CatBoost** (handles the many-feature, some-categorical, some-missing setting natively and robustly, per the reference documents' Finding 1).
- **Secondary ensemble member / challenger**: **LightGBM**, plus a plain **regularized Logistic Regression** as a simple, maximally-interpretable challenger to sanity-check the boosted models aren't learning spurious artifacts.
- **Feature selection**: stability selection (repeated subsampling + LASSO/GBDT-importance agreement, selection frequency ≥ 0.6–0.8 kept) exactly as justified in the reference research — this matters even more once the feature set grows (statement features + graph features + rule outputs combined).
- **No SMOTE.** Use class-weighting (`scale_pos_weight` / `class_weight="balanced"`) and never resample the minority class synthetically — per the reference documents' explicit, well-evidenced correction: SMOTE distorts calibration, which this system depends on (11.5).
- **Calibration**: fit Platt scaling or isotonic regression (choose by comparing Brier score on a held-out fold) on top of the raw model score so the number shown is a **true probability**, not a raw boosted-tree logit.
- **Evaluation**: PR-AUC / average precision (never bare accuracy, which is meaningless under the severe class imbalance mule detection always has), recall at a defined analyst review budget, precision within the auto-flag tier, calibration error (ECE/Brier) — all computed and stored so the tool can honestly report its own real, local, on-your-data performance rather than an imported, non-transferable benchmark number.
- **Explainability**: SHAP values per prediction, but SHAP output is only ever used to populate the human-readable "top contributing factors" list in the Evidence Bundle — never surfaced as an unexplained bar chart with anonymized feature names; map SHAP-driving features back to the plain-language feature descriptions from the registry (Section 9.7).

### 11.5 Fusion — combining rules + anomaly + (optional) supervised score into one number, deterministically
```
if supervised_model_available:
    fused_score = 0.40*normalize(rule_score) + 0.25*normalize(anomaly_score) + 0.35*calibrated_supervised_probability
else:
    fused_score = 0.65*normalize(rule_score) + 0.35*normalize(anomaly_score)
```
All weights live in `config/thresholds.yaml`, are documented, and are shown in the Evidence Bundle exactly as used for that specific account's score — an investigator can always see precisely how the final number was assembled, and change the weights themselves if their institution's risk appetite differs, with the change immediately reflected (no retraining needed for the rule/anomaly layers).

### 11.6 Three-tier decision policy (never force a binary verdict — mirrors the reference documents' "selective classification" idea, adapted)
```
IF fused_score >= T_high  (default 75)
   AND at least one Layer-1 rule triggered
   AND (no unresolved extraction-confidence problem on this statement):
      → CONFIRMED SUSPICIOUS  (recommend: hold / escalate / file internally per institution policy)
ELIF fused_score <= T_low  (default 25)
   AND anomaly_score is low
   AND extraction_confidence is HIGH:
      → LIKELY LEGITIMATE (no automatic action; continue normal monitoring)
ELSE:
      → REVIEW REQUIRED  (ranked queue for human investigation; never auto-escalated, never auto-cleared)
```
`T_high`/`T_low` are configurable, and the system must **never claim "zero false positives"** — instead, next to any CONFIRMED SUSPICIOUS result, show the tool's own historical precision-in-this-tier statistic once enough locally-confirmed outcomes exist to compute one honestly (Section 21.4), and show "not yet enough local outcome data to estimate real-world precision" before that point — **honesty over a marketing-friendly but false number**.

---

## 12. MODULE H — PROOF / EVIDENCE-BUNDLE ENGINE

### 12.1 Purpose
Assemble, for every scored account, **one canonical JSON object** that is (a) the complete, sole source of truth for the dashboard UI, (b) the complete, sole input given to the local LLM for narrative generation (Section 15) — the LLM never sees anything not in this object — and (c) exportable as a standalone audit artifact (PDF/JSON) an investigator can archive or hand to a compliance officer.

### 12.2 Evidence Bundle schema (illustrative — implement as a strict Pydantic model)
```json
{
  "account_summary": {
    "statement_id": "...",
    "observed_period": {"start": "...", "end": "..."},
    "extraction_confidence": 0.994,
    "statement_likelihood_score": 0.91,
    "transaction_count": 214
  },
  "final_decision": {
    "tier": "REVIEW_REQUIRED",
    "fused_score": 58.3,
    "score_formula_used": "0.40*rule_score + 0.25*anomaly_score (no supervised model active)",
    "thresholds_applied": {"T_high": 75, "T_low": 25}
  },
  "triggered_rules": [
    {
      "id": "R5_circular_flow_detected",
      "description": "...",
      "formula": "max_cycle_risk_score > 0.6",
      "computed_value": 0.74,
      "points": 30,
      "contributing_row_ids": ["stmt1-row44", "stmt1-row51", "stmt1-row58"]
    }
  ],
  "features": [
    {"name": "net_retention_ratio", "value": 0.09, "formula": "...", "explanation": "..."}
  ],
  "cycles_detected": [
    {
      "cycle_id": "C1",
      "nodes": ["ACCT_SUBJECT", "CPTY_A", "CPTY_B"],
      "hop_count": 3,
      "amount_conservation_ratio": 0.93,
      "cycle_span_days": 2.1,
      "cycle_risk_score": 0.81,
      "contributing_row_ids": ["stmt1-row12", "stmt1-row15", "stmt1-row20"]
    }
  ],
  "anomaly_detail": {
    "isolation_forest_score": 0.71,
    "top_contributing_features": ["turnover_ratio", "fan_in_score"],
    "seed": 42
  },
  "supervised_detail": null,
  "guardrail_log": {
    "ood_check_passed": true,
    "reconciliation_rate": 0.994,
    "manual_mapping_used": false
  }
}
```

### 12.3 Full traceability rule
Every element that appears in `triggered_rules[].contributing_row_ids` and `cycles_detected[].contributing_row_ids` MUST correspond to a real `row_id` that exists in the parsed transaction table and MUST be independently highlightable in the Transaction Table UI and the Proof Graph. Build an automated test that asserts every evidence-bundle `row_id` reference resolves (Section 21).

---

## 13. MODULE I — LOCAL LLM NARRATIVE LAYER (Ollama) — strict "summarize only, never calculate" contract

### 13.1 Model selection & justification
Run entirely through a local `ollama serve` instance (default `http://127.0.0.1:11434`), never a hosted API.

- **Recommended default model**: **`qwen2.5:7b-instruct`** (alternatively `llama3.1:8b-instruct`) — chosen for strong instruction-following and reliable structured-input handling at a size that runs acceptably on a typical investigator laptop/workstation (8–16GB RAM) without a dedicated GPU.
- **Low-resource fallback**: **`qwen2.5:3b-instruct`** or **`phi4-mini`** — for machines with tighter RAM, at a modest quality cost; document the tradeoff plainly in the README and let the user pick their model in settings.
- **Do not** use a general "chat" default with no instruction tuning, and do not use a reasoning/"thinking" model here — this task needs faithful paraphrasing, not creative reasoning, and larger "smart" models are unnecessary cost for zero benefit on this narrow job.
- Model is pulled **once**, at setup time (`ollama pull qwen2.5:7b-instruct`), and cached in a Docker volume — no pull attempt at runtime, so the running app never needs internet.

### 13.2 The hard architectural constraint
The narrative generator function's signature must make it **structurally impossible** to leak raw transactions or unaudited numbers into the prompt:
```python
def generate_narrative(evidence_bundle: EvidenceBundle) -> str:
    # Only ever receives the already-finalized EvidenceBundle Pydantic object.
    # Never receives the raw transaction DataFrame.
    # Never receives network access.
    ...
```
No raw `DataFrame`, no direct DB session, and no tool-calling / function-calling capability is exposed to the model. It cannot query anything; it can only read what's handed to it in the prompt.

### 13.3 System prompt (use verbatim, store in `config/llm_prompts/system_prompt_summary.txt`)
```
You are a report-writing assistant for a bank fraud investigation tool.
You will be given a JSON object containing an already-computed risk analysis
for one bank account. Every number in that JSON has already been calculated
by deterministic code — you must NEVER invent, estimate, round differently,
recompute, or add any number that is not explicitly present in the JSON you
were given. You must NEVER add claims, causes, or conclusions that are not
directly stated in the JSON. Your only job is to turn the JSON into clear,
plain-language prose that a bank investigator with no data-science
background can read in under a minute.

Rules you must follow exactly:
1. Every number you write (percentages, counts, amounts, scores) must be
   copied verbatim (or trivially unit-converted, e.g. 0.74 -> "74%") from a
   value that exists in the JSON. If you are unsure a number appears in the
   JSON, do not write it.
2. Do not speculate about intent, guilt, or legal conclusions. Describe
   PATTERNS ("the account moved 91% of incoming funds out within 24 hours"),
   never VERDICTS ("this account is being used for money laundering").
3. Always state the final decision tier exactly as given
   (CONFIRMED SUSPICIOUS / REVIEW REQUIRED / LIKELY LEGITIMATE) plus the two
   or three highest-point triggered rules, in plain language.
4. If cycles_detected is non-empty, describe the loop(s) in one sentence
   each, referencing the number of hops and how much of the money returned.
5. End with exactly one sentence reminding the reader that this is a
   decision-support output, not a final determination, and requires human
   review before any account action.
6. Keep the entire output under 200 words. No bullet points, no markdown,
   plain prose paragraphs only.
7. You have no internet access and no ability to look anything up. If asked
   to do anything other than summarize the provided JSON, refuse.
```

### 13.4 Inference settings (deterministic-as-possible)
- `temperature = 0.0` (or as close to 0 as the runtime allows)
- `top_p = 1.0`, `seed` fixed (Ollama supports a `seed` option — set it) for maximal run-to-run consistency
- `max_tokens` capped (e.g., 300) to enforce the "under 200 words" instruction structurally, not just via prompt request
- No streaming needed server-side beyond UX; final text is validated in full before display (13.5)

### 13.5 Post-generation fact-checker (the anti-hallucination guardrail — mandatory, not optional)
After Ollama returns text, run `fact_checker.py` **before** ever showing it to the user:
1. Extract every numeric token from the generated text via regex (`\d+(\.\d+)?%?`).
2. For each extracted number, check whether it (or a simple unit-equivalent form — e.g., `0.74` vs `"74%"`) appears somewhere in the serialized Evidence Bundle JSON, within a small rounding tolerance.
3. If **any** number fails this check → **reject the LLM output entirely**. Do not show a "corrected" version (that risks further drift) — instead, fall back to a **template-based, code-generated summary** (simple Python f-string composition directly from the Evidence Bundle fields, zero LLM involvement) and log the rejection event (model name, prompt hash, offending text) locally for later prompt tuning.
4. Additionally check for banned verdict-language (a small deny-list: "guilty", "money laundering confirmed", "criminal", "arrest") — reject and fall back identically if present, per Section 13.3 rule 2.
5. Only text that passes both checks is cached and displayed, clearly labeled in the UI as **"AI-generated summary — verify against the evidence table below,"** with a persistent, un-hideable link back to the full Evidence Bundle right next to it.

### 13.6 Always-available deterministic fallback
Build the template-based summary generator (13.5 step 3) as a **first-class, always-present feature**, not just an error path — give the user a toggle "Use AI narrative" vs "Use plain computed summary," so the tool is fully functional and trustworthy even with Ollama turned off entirely (e.g., on a machine too resource-constrained to run any local LLM at all). **The entire detection and scoring pipeline must work with zero LLM involvement** — the LLM is strictly a convenience layer on top of a system that is already complete without it.

---

## 14. MODULE J — GLOBAL GUARDRAIL MIDDLEWARE

Implement as FastAPI middleware wrapping every request/response:
- **Egress assertion**: at app startup, monkey-patch/verify no HTTP client in the process is configured with a non-localhost, non-Ollama base URL; fail startup loudly if any config value looks like an external API endpoint.
- **PII-safe logging**: structured logger that redacts account numbers, full names, and narration text from log lines by default (configurable to a verbose local-debug mode only, never shipped as the default).
- **Determinism decorator**: `@deterministic` decorator (in `determinism_guard.py`) applied to every scoring/feature function, which asserts at test time that calling the function twice with the same input yields byte-identical output — used directly in the test suite (Section 21) as a blanket regression guard.
- **OOD gate enforcement**: no statement may reach Modules D–I unless it has passed the Section 6.4 gate (or the user explicitly overrode a MEDIUM-confidence warning) — enforced at the service layer, not just the UI, so the guarantee holds even if someone calls the API directly.

---

## 15. MODULE L — BACKEND API SURFACE (implement these endpoints)

```
POST   /api/statements/upload          multipart file(s) upload → returns statement_id(s), OOD score, extraction preview
GET    /api/statements/{id}/preview    first N raw rows + detected column mapping, for the Extraction Review screen
POST   /api/statements/{id}/mapping    manual column mapping override (Section 7.5)
POST   /api/statements/{id}/confirm    lock in extraction, trigger feature/scoring pipeline
GET    /api/statements/{id}/evidence   full Evidence Bundle JSON (Section 12)
GET    /api/statements/{id}/transactions   paginated, filterable transaction table with tags (rule/cycle membership)
GET    /api/statements/{id}/graph      graph nodes/edges + detected cycles, ready for the frontend graph renderer
GET    /api/statements/{id}/narrative  AI or template summary (Section 13)
POST   /api/batch/merge                merge multiple statement_ids into one cross-account graph (Section 10.5)
GET    /api/health/offline-check       explicit self-test confirming no outbound network calls are configured
POST   /api/labels/{statement_id}      investigator feedback: mark an account's true outcome (feeds Section 11.4 / 21.4)
GET    /api/config/thresholds          read current thresholds.yaml (for the transparency panel)
PUT    /api/config/thresholds          update thresholds (admin-only, requires local confirmation)
```

---

## 16. MODULE M — FRONTEND / DASHBOARD REQUIREMENTS

### 16.1 Upload Page
Drag-and-drop multi-file upload; live OOD score preview per file with the specific pass/fail signal breakdown (Section 6.4) rendered as a checklist, not a black box.

### 16.2 Extraction Review Page
Raw-row grid with editable column-mapping dropdowns; big, unmissable reconciliation-rate badge (green/amber/red per Section 7.6 tiers); "Confirm & Analyze" button disabled until confidence is acceptable or the user explicitly acknowledges a low-confidence override.

### 16.3 Dashboard Page
- **Risk Gauge**: fused score 0–100 with the tier (CONFIRMED SUSPICIOUS / REVIEW REQUIRED / LIKELY LEGITIMATE) in large, unambiguous text and color.
- **Metric cards**: every Section 9 feature, grouped by family (Lifecycle / Behavior / Structuring / Network), each showing its value AND a one-line formula tooltip on hover — **nothing is shown without its formula being one click away**.
- **Triggered Rules panel**: list of every fired rule, its description, computed value vs threshold, and point contribution, sortable by points.
- **Charts**: monthly inflow/outflow bar chart, category breakdown pie/bar, balance-over-time line chart, rolling 24h transaction-velocity chart — all Recharts, all driven directly from computed feature/time-series data (no chart ever shows an LLM-invented number).
- **AI Narrative panel**: clearly labeled "AI-generated," collapsible, always sitting directly above/beside the Evidence table it summarizes, with the "Use plain computed summary instead" toggle (Section 13.6).

### 16.4 Evidence Explorer Page
Full, filterable, exportable view of the raw Evidence Bundle JSON alongside a human-readable rendering of it — this is the page an investigator would print/export for a compliance file. Include a **"Export Evidence Report (PDF)"** button (server-side render via a lightweight local HTML→PDF tool, e.g., WeasyPrint — no cloud rendering service).

### 16.5 Proof Graph Page ("map every transaction")
- Interactive Cytoscape.js graph: subject account + counterparties as nodes (sized by total flow value), transactions as directed edges (thickness by amount, color by channel/category).
- **Every detected cycle is drawn as a highlighted closed loop** (distinct color, animated flow direction optional) with a click-to-inspect panel showing the exact `cycles_detected[]` entry and its contributing transactions.
- Clicking any node or edge cross-filters the Transaction Table (16.3-adjacent) to show only the relevant rows — true click-to-drill-down traceability from graph → evidence → raw row, satisfying "map each and every transaction."
- A legend explaining every visual encoding (node size, edge thickness/color, loop highlight) so the graph is self-explanatory to a non-technical investigator.
- In multi-statement mode, allow toggling between "this account only" (ego-graph) and "full merged network" views.

---

## 17. MODULE N — DATABASE SCHEMA (SQLite via SQLModel; DuckDB optionally for heavy analytics)

Core tables (implement as SQLModel classes in `db/models.py`):
- `statements` (id, filename_hash — never store the raw filename if it contains PII unless user opts in, upload_ts, ood_score, reconciliation_rate, template_id_used, status)
- `transactions` (row_id PK, statement_id FK, txn_date, narration, debit_amount, credit_amount, balance_after, channel, category, counterparty_id FK, row_confidence)
- `counterparties` (id PK, canonical_name, raw_variants[], is_self_transfer)
- `evidence_bundles` (statement_id FK, json_blob, created_ts, score_version — bump this whenever scoring logic/thresholds change, so old evidence bundles are never silently reinterpreted under new rules)
- `cycles` (id PK, statement_id/batch_id FK, node_sequence[], hop_count, amount_conservation_ratio, cycle_risk_score)
- `investigator_labels` (statement_id FK, confirmed_outcome [mule/legitimate/inconclusive], labeled_ts, labeled_by) — purely local, feeds Section 11.4/21.4, never leaves the machine.
- `config_audit_log` (who/when changed which threshold — accountability for a tool whose outputs may affect real accounts).

---

## 18. FRONTEND ASSET / OFFLINE HYGIENE

- Run `npm install` at build time only; ship a fully bundled `dist/` in the Docker image. No `<script src="https://...">` anywhere, ever — vet this with an automated grep in CI over the built `dist/` output for the literal string `http` pointing outside `localhost`.
- Fonts: bundle a system-safe font stack or a locally-vendored font file, not a Google Fonts CDN link.

---

## 19. MODULE P — DEPLOYMENT (fully local, one command)

`docker-compose.yml` (shape to implement):
```yaml
services:
  ollama:
    image: ollama/ollama
    volumes:
      - ollama_models:/root/.ollama
    ports:
      - "127.0.0.1:11434:11434"
    # model pulled once via an init container / setup script, cached in the volume thereafter

  muleguard:
    build: ./backend         # multi-stage build: builds frontend, copies dist/ into the FastAPI image
    depends_on:
      - ollama
    environment:
      - OLLAMA_HOST=http://ollama:11434
      - DATA_DIR=/data
    volumes:
      - ./data:/data
    ports:
      - "127.0.0.1:8000:8000"
    # no other network egress required or permitted

volumes:
  ollama_models:
```
Provide a single `./setup.sh` that: builds images, pulls the chosen Ollama model into the volume, runs DB migrations, and prints "MuleGuard is ready at http://localhost:8000 — this application does not require, and will not use, an internet connection from this point forward."

---

## 20. GUARDRAIL SUMMARY TABLE (cross-reference — implement automated tests for every row)

| Guardrail | Enforced where | Automated test |
|---|---|---|
| No API keys / no external calls | `privacy_guard.py` middleware + Docker network isolation | `network_mode: none` integration test still processes a sample statement end-to-end |
| LLM never computes numbers | `narrative_generator.py` contract + `fact_checker.py` | Unit test: feed a deliberately-adversarial fake Ollama response containing an invented number → assert rejection + fallback triggered |
| OOD rejection | `ood_detector.py` | Feed non-statement fixtures (resume PDF, random CSV) → assert hard reject with correct reason codes |
| Extraction accuracy self-proof | `reconciliation.py` | Feed fixtures with known-correct balances → assert 100% reconciliation; feed a corrupted fixture → assert correct LOW confidence flag |
| Determinism | `determinism_guard.py` decorator | Run every scoring function twice on identical input → byte-identical output |
| Full evidence traceability | `evidence_bundle.py` | Assert every `row_id` referenced in an evidence bundle exists in the transactions table |
| No hardcoded/blind thresholds | `thresholds.yaml` is the only source | Static check: no bare numeric literal thresholds inside scoring/feature code, only references to the loaded config object |
| Cycle-detection correctness | `cycle_detector.py` | Hand-built synthetic 3-node and 4-node cycle fixtures with known expected cycles → assert exact match |

---

## 21. TESTING, VALIDATION & SYNTHETIC DATA PLAN

### 21.1 Unit tests
Every extractor, feature function, and scoring function gets a dedicated test file with hand-computed expected values (not just "does it run without error").

### 21.2 Golden fixture statements
Build synthetic (fully fake, non-real-person) statements covering: (a) every bank template in the registry, in both clean and messy (multi-header-page, encoding-broken, partial-OCR) form, (b) at least one deliberately non-statement file per OOD category, (c) at least one deliberately corrupted-balance statement to test the reconciliation guardrail.

### 21.3 Synthetic mule-pattern ground truth
Hand-construct statements with a **known, designed-in ground truth**: e.g., "Case A: obvious 3-hop circular flow completing within 6 hours, 96% amount conservation" → assert the pipeline flags `CONFIRMED SUSPICIOUS` with the correct cycle in `cycles_detected`; "Case D: ordinary salaried household account with stable retention" → assert `LIKELY LEGITIMATE`; "Case E: unusual but explainable pattern (e.g., a small business with genuine high turnover)" → assert `REVIEW REQUIRED`, never a false confident verdict either way. This directly operationalizes the "prove it's not randomly guessing" requirement as a CI-enforced regression suite.

### 21.4 Local performance self-reporting (once labels exist)
Once `investigator_labels` accumulates enough rows, compute and display (never invent before this data exists): PR-AUC / average precision, precision within the CONFIRMED SUSPICIOUS tier, recall at the current review-queue capacity, calibration error — exactly the honest, non-inflated metric set the reference research recommends, computed **only on this installation's own local, real outcomes**, never borrowed from an external benchmark.

---

## 22. BUILD PHASES FOR ANTIGRAVITY (execute in this order; do not parallelize across phases — each depends on the previous being solid)

**Phase 0 — Scaffolding.** Repo structure (Section 5), dependency locking, empty FastAPI app booting, empty React app booting, Docker Compose skeleton with Ollama service, `docker-compose up` succeeding end-to-end with a "hello world" API round trip. *Done when:* one command starts everything and the health endpoint responds.

**Phase 1 — Ingestion & OOD guardrail.** File router, CSV/XLSX extractor, PDF extractor (text-layer first, OCR later in this phase), Section 6.4 OOD scorer with full signal breakdown returned via API. *Done when:* uploading the golden fixtures (21.2) correctly accepts real-shaped statements and rejects the OOD fixtures, with reasons shown.

**Phase 2 — Understanding & validation.** Template registry + Tier-1/Tier-2 header classification, canonical schema mapping, manual mapping UI, reconciliation engine (7.6). *Done when:* every golden fixture statement reaches ≥98% reconciliation automatically, or is correctly routed to manual review when intentionally messy.

**Phase 3 — Categorization.** Channel inference, category rules, counterparty extraction/normalization, self-transfer detection. *Done when:* categorized output on golden fixtures matches hand-labeled expected categories at ≥90% on the test set (measure and report this number, don't just assert "looks right").

**Phase 4 — Feature engineering.** Implement every feature in Section 9 with docstring formulas and full unit tests with hand-computed expected values. *Done when:* 100% of features pass unit tests and are registered in `feature_registry.py`.

**Phase 5 — Graph & cycle detection.** Graph builder, Tarjan SCC + Johnson's cycle enumeration, cycle scoring, multi-statement merge. *Done when:* the synthetic circular-flow fixtures (21.3 Case A) are detected with the exact expected node sequence and correct risk score.

**Phase 6 — Scoring engine.** Rule engine (11.2), Isolation Forest + MAD anomaly layer (11.3), fusion (11.5), three-tier decision policy (11.6). Supervised layer (11.4) built but gated/disabled until the label threshold is met — verify the gate itself works (test that it stays off with < 200 labels). *Done when:* all Section 21.3 synthetic ground-truth cases resolve to the correct tier.

**Phase 7 — Evidence bundle & traceability.** Full schema (12.2), row_id resolution tests (12.3). *Done when:* the automated traceability test (Section 20 table) passes on every golden fixture.

**Phase 8 — Local LLM layer.** Ollama client, system prompt wiring, fact-checker, template-based fallback, model-selection settings UI. *Done when:* the adversarial fake-hallucination unit test (Section 20 table) passes, and a real end-to-end run against a running Ollama instance produces a fact-checked, under-200-word narrative for every golden fixture.

**Phase 9 — Frontend build-out.** All five pages (Section 16), API wiring, Cytoscape proof graph with cycle highlighting and click-to-drill-down. *Done when:* a human can go from upload → confirmed extraction → dashboard → click a triggered rule → see the exact highlighted transactions → click the proof graph → see the same rows highlighted there too, with zero dead ends.

**Phase 10 — Guardrail hardening & deployment.** Network-isolation integration test, PII-log redaction test, full Docker Compose offline run, `setup.sh`, README with exact run instructions and an explicit "what this tool does and does not guarantee" section (no false claims of legal certainty). *Done when:* the entire Section 20 guardrail table is green in CI.

---

## 23. DEFINITION OF DONE — FULL PRODUCT ACCEPTANCE CHECKLIST

- [ ] Runs fully offline after initial `setup.sh` (verified by the `network_mode: none` test).
- [ ] No API keys anywhere in the codebase or config.
- [ ] Accepts PDF, CSV, and XLSX bank statements across multiple templates, with a self-learning local template registry.
- [ ] Rejects non-statement files with explicit, evidence-based reasons, never a black-box refusal.
- [ ] Every extraction is self-verified via running-balance reconciliation, with the confidence number shown everywhere that data is used downstream.
- [ ] Every score, ratio, and metric on screen traces to a named function with an explicit formula, viewable by the user.
- [ ] Circular fund flows are detected via Tarjan SCC + Johnson's algorithm, scored with amount-conservation and velocity metrics, and rendered as highlighted loops on an interactive proof graph.
- [ ] No decision is ever a bare binary — every account resolves to CONFIRMED SUSPICIOUS / REVIEW REQUIRED / LIKELY LEGITIMATE with full supporting evidence.
- [ ] The optional supervised ML layer only activates once enough locally-labeled ground truth exists, and this gate is tested.
- [ ] The local LLM only ever paraphrases an already-computed Evidence Bundle; a post-generation fact-checker rejects any hallucinated number, with a deterministic template fallback always available and always fully functional even with the LLM disabled.
- [ ] Every evidence-bundle transaction reference resolves to a real, highlightable row in the UI.
- [ ] All thresholds live in one human-editable config file, never hardcoded inline.
- [ ] Full automated test suite (Section 21) passes, including the synthetic ground-truth mule/legitimate/ambiguous cases.
- [ ] README clearly states the tool's limitations (single-statement mode cannot prove multi-hop external cycles; this is a decision-support tool requiring human review; local performance metrics are only meaningful once local labels accumulate).

---

## 24. APPENDIX A — FORMULA QUICK-REFERENCE SHEET

| Metric | Formula |
|---|---|
| Net retention ratio | `1 - (matched 24h outflow) / (total inflow)` |
| Turnover ratio | `(total debit + total credit) / average daily balance` |
| Average daily balance | area under `balance_after(t)` curve ÷ observed days |
| Near-threshold ratio | fraction of transactions within configurable % band below reporting threshold |
| Benford deviation | `Σ_d ((observed(d) - expected_p(d)·N)² / (expected_p(d)·N))`, `expected_p(d)=log10(1+1/d)` |
| Fan-in / fan-out score | distinct counterparties in/out per rolling window ÷ transaction count |
| Counterparty concentration (HHI) | `Σ(share_i)²` over counterparty value share |
| Amount conservation ratio (cycle) | `1 - |Σoutflow - Σinflow| / max(Σoutflow, Σinflow)` around a detected cycle |
| Velocity compression (cycle) | `hop_count / cycle_span_days` |
| Reconciliation rate | `(# rows where balance_after[t] == balance_after[t-1] - debit[t] + credit[t] ± tolerance) / (# rows with balance)` |
| Modified z-score (robust outlier) | `0.6745 × (x - median) / MAD` |
| Rule score | `min(100, Σ points of triggered rules)` |
| Fused score (no supervised model) | `0.65·normalize(rule_score) + 0.35·normalize(anomaly_score)` |
| Fused score (with supervised model) | `0.40·normalize(rule_score) + 0.25·normalize(anomaly_score) + 0.35·calibrated_probability` |

## 25. APPENDIX B — ALGORITHM SELECTION SUMMARY (the "which algorithm and why" the user asked for)

| Task | Chosen algorithm | Why this one, specifically |
|---|---|---|
| Table extraction from native-text PDFs | `pdfplumber`, fallback `camelot` (lattice→stream) | Best open-source accuracy on ruled/unruled bank-statement tables; fully local |
| Scanned PDF text | Tesseract OCR (`pytesseract`) | Mature, fully offline, per-word confidence output feeds row-confidence scoring |
| Header→schema mapping | Fuzzy token matching (`rapidfuzz`) + rule-based content heuristics, template registry first | Deterministic, explainable, no training data needed, improves per-bank over time via local learning |
| Extraction self-check | Running-balance arithmetic reconciliation | The only fully deterministic, ground-truth-free way to *prove* extraction correctness from the statement's own internal consistency |
| Cycle candidate filtering | Tarjan's SCC algorithm | Linear time, standard, cheaply prunes the graph before expensive enumeration |
| Circular flow enumeration | Johnson's algorithm (`networkx.simple_cycles`, bounded) | Exact, complete enumeration of elementary cycles — gives provable transaction lists, unlike a learned graph model |
| Unlabeled anomaly detection | Isolation Forest + robust MAD z-score cross-check | No labels required, fast, standard baseline, fully seed-reproducible, and cross-checked by a hand-computable statistic |
| Amount-distribution anomaly | Benford's Law chi-square test | Well-established, fully deterministic forensic-accounting statistic |
| Optional supervised classification (once labeled data exists) | CatBoost primary, LightGBM + logistic regression as challengers | State-of-the-art and most current evidence-backed choice for flat tabular data (Grinsztajn 2022; Shwartz-Ziv & Armon 2022); CatBoost's native categorical/missing handling suits messy real-world statement-derived features |
| Score calibration | Platt scaling / isotonic regression (chosen by Brier score) | Converts raw model output into a trustworthy probability, essential since the fused score drives a real decision |
| Local narrative generation | Ollama, `qwen2.5:7b-instruct` (default) / `qwen2.5:3b-instruct` or `phi4-mini` (low-resource) | Strong instruction-following for faithful JSON→prose paraphrasing at a size that runs locally without a GPU; explicitly not used for any numerical or classification task |

---

**End of master prompt. Build exactly this. Where you must make a small implementation judgment call not spelled out above, default to the more conservative, more explainable, more privacy-preserving option every time.**
