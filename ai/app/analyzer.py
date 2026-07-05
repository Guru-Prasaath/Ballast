"""Orchestrates one analysis pass: for every org, compute signals, detect
findings, and write de-duplicated advisories. This is the whole loop, off the
hot path — it only reads history and writes advisory rows."""

from __future__ import annotations

import logging

from .advisor import draft_advisory
from .db import get_conn
from .detectors import detect
from .signals import compute_org_signals, distinct_org_ids
from .writer import embed, ensure_schema, insert_advisory, is_duplicate

log = logging.getLogger("ai.analyzer")


def analyze_all() -> dict:
    created = 0
    examined = 0
    with get_conn() as conn:
        pgvector_ok = ensure_schema(conn)
        for org_id in distinct_org_ids(conn):
            signals = compute_org_signals(conn, org_id)
            for finding in detect(signals):
                examined += 1
                embedding = embed(
                    f"{finding.kind} {finding.queue_name} {finding.headline}"
                )
                if is_duplicate(conn, org_id, finding, embedding, pgvector_ok):
                    continue
                draft = draft_advisory(finding)
                insert_advisory(conn, org_id, finding, draft, embedding, pgvector_ok)
                created += 1

    return {"findings": examined, "created": created, "pgvector": pgvector_ok}
