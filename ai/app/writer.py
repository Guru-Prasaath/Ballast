"""Persists advisories to the database, de-duplicating against recent ones.

Uses scikit-learn to embed each advisory's signature into a fixed 256-dim vector
and pgvector to find near-duplicates by cosine distance. Both degrade gracefully:
if pgvector or scikit-learn is unavailable, it falls back to a (kind, queue)
signature dedup so the pipeline still works.
"""

from __future__ import annotations

import logging

import psycopg

from .advisor import AdvisoryDraft
from .config import settings
from .detectors import Finding

log = logging.getLogger("ai.writer")

_EMBED_DIM = 256


def ensure_schema(conn: psycopg.Connection) -> bool:
    """Enable pgvector and add the advisory embedding column. Returns whether
    pgvector is usable."""
    try:
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        conn.execute(
            f"ALTER TABLE advisories ADD COLUMN IF NOT EXISTS "
            f"embedding vector({_EMBED_DIM})"
        )
        conn.commit()
        return True
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        log.warning("pgvector unavailable, using signature dedup: %s", exc)
        return False


def embed(text: str) -> list[float] | None:
    """A fixed-dimension embedding via scikit-learn's HashingVectorizer — no
    model download, deterministic, good enough for near-duplicate detection."""
    try:
        from sklearn.feature_extraction.text import HashingVectorizer

        vectorizer = HashingVectorizer(
            n_features=_EMBED_DIM, alternate_sign=False, norm="l2"
        )
        return vectorizer.transform([text]).toarray()[0].tolist()
    except Exception as exc:  # noqa: BLE001
        log.warning("embedding unavailable: %s", exc)
        return None


def _vec_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"


def is_duplicate(
    conn: psycopg.Connection,
    org_id: str,
    finding: Finding,
    embedding: list[float] | None,
    pgvector_ok: bool,
) -> bool:
    hours = settings.lookback_hours
    if pgvector_ok and embedding is not None:
        row = conn.execute(
            """
            SELECT 1 FROM advisories
             WHERE org_id = %s
               AND created_at > now() - make_interval(hours => %s)
               AND embedding IS NOT NULL
               AND (embedding <=> %s::vector) < %s
             LIMIT 1
            """,
            (org_id, hours, _vec_literal(embedding), settings.dedup_distance),
        ).fetchone()
        return row is not None

    row = conn.execute(
        """
        SELECT 1 FROM advisories
         WHERE org_id = %s AND kind = %s AND queue_id IS NOT DISTINCT FROM %s
           AND created_at > now() - make_interval(hours => %s)
         LIMIT 1
        """,
        (org_id, finding.kind, finding.queue_id, hours),
    ).fetchone()
    return row is not None


def insert_advisory(
    conn: psycopg.Connection,
    org_id: str,
    finding: Finding,
    draft: AdvisoryDraft,
    embedding: list[float] | None,
    pgvector_ok: bool,
) -> None:
    confidence = max(0.0, min(1.0, float(draft.confidence)))
    if pgvector_ok and embedding is not None:
        conn.execute(
            """
            INSERT INTO advisories
              (org_id, kind, severity, title, summary, recommendation,
               confidence, queue_id, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
            """,
            (
                org_id,
                finding.kind,
                finding.severity,
                draft.title,
                draft.summary,
                draft.recommendation,
                confidence,
                finding.queue_id,
                _vec_literal(embedding),
            ),
        )
    else:
        conn.execute(
            """
            INSERT INTO advisories
              (org_id, kind, severity, title, summary, recommendation,
               confidence, queue_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                org_id,
                finding.kind,
                finding.severity,
                draft.title,
                draft.summary,
                draft.recommendation,
                confidence,
                finding.queue_id,
            ),
        )
    conn.commit()
