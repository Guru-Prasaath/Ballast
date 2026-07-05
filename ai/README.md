# Ballast — AI Advisory Service

A separate Python service that analyzes job failures and writes **advisories**
into the database the dashboard already renders. It is **advisory and
asynchronous** — it never sits between a job and a worker, and the core runs
correctly with it switched off (invariant #6).

## What it does

On a short interval (and on demand via `POST /analyze`) it:

1. Reads recent jobs and attempts per org (never on the hot path).
2. Computes per-queue **signals** — dead-letter counts, flaky (retry-then-succeed)
   jobs, failure rates, backlog vs concurrency, and the dominant error pattern.
3. Rule-based **detectors** decide which signals warrant an advisory (so the
   system behaves predictably; the AI writes the words, not the decision).
4. **Claude** (`claude-opus-4-8`, structured output) turns each finding into a
   title, summary, recommendation, and confidence. Without `ANTHROPIC_API_KEY`
   a deterministic template does this instead, so the pipeline still runs.
5. **scikit-learn + pgvector** de-duplicate: each advisory is embedded to a
   fixed 256-dim vector and compared by cosine distance to recent ones, so the
   same problem isn't re-advised every pass.

## Stack

Python 3.12 · FastAPI · Anthropic SDK · scikit-learn · pgvector · psycopg

## Run

```bash
cd ai
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # set DATABASE_URL (and optionally ANTHROPIC_API_KEY)
uvicorn app.main:app --port 8000
```

| Endpoint | Purpose |
| -------- | ------- |
| `GET /health` | DB connectivity + whether Claude is configured |
| `POST /analyze` | Run one analysis pass now; returns counts |

Tests: `pytest` (pure logic — no DB or network).

## Layout

```
app/
  config.py     env
  db.py         Postgres connection + health ping
  signals.py    per-queue failure signals + dominant-error grouping
  detectors.py  rule-based findings (what's worth advising on)
  advisor.py    Claude structured output (+ deterministic fallback)
  writer.py     scikit-learn embeddings + pgvector dedup + insert
  analyzer.py   one analysis pass over all orgs
  main.py       FastAPI app + background loop
```
