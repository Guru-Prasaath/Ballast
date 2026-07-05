"""Reads the database and computes per-queue failure signals for one org.
These are the raw inputs the advisor turns into recommendations."""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

import psycopg

from .config import settings

# Collapse volatile bits (ids, durations) so "Timeout after 30000ms" and
# "Timeout after 45000ms" group into one pattern.
_NUM = re.compile(r"0x[0-9a-fA-F]+|\d+")


def _normalize(error: str) -> str:
    return _NUM.sub("N", error).strip()


def dominant_error(errors: list[str]) -> tuple[str | None, float]:
    """The most common (normalized) error pattern and its share of failures."""
    if not errors:
        return None, 0.0
    counts = Counter(_normalize(e) for e in errors)
    label, count = counts.most_common(1)[0]
    return label, count / len(errors)


@dataclass
class QueueSignal:
    queue_id: str
    queue_name: str
    concurrency_limit: int
    ready: int = 0
    running: int = 0
    dead: int = 0
    flaky: int = 0  # completed jobs that needed more than one attempt
    succeeded_24h: int = 0
    failed_24h: int = 0
    dominant_error: str | None = None
    dominant_error_share: float = 0.0

    @property
    def attempts_24h(self) -> int:
        return self.succeeded_24h + self.failed_24h

    @property
    def failure_rate_24h(self) -> float:
        return self.failed_24h / self.attempts_24h if self.attempts_24h else 0.0


def compute_org_signals(
    conn: psycopg.Connection, org_id: str
) -> list[QueueSignal]:
    hours = settings.lookback_hours

    rows = conn.execute(
        """
        SELECT q.id, q.name, q.concurrency_limit,
               count(*) FILTER (WHERE j.status = 'ready')                       AS ready,
               count(*) FILTER (WHERE j.status = 'running')                     AS running,
               count(*) FILTER (WHERE j.status = 'dead')                        AS dead,
               count(*) FILTER (WHERE j.status = 'completed' AND j.attempts > 1) AS flaky
          FROM queues q
          JOIN projects p ON p.id = q.project_id
          LEFT JOIN jobs j ON j.queue_id = q.id
         WHERE p.org_id = %s
         GROUP BY q.id, q.name, q.concurrency_limit
        """,
        (org_id,),
    ).fetchall()

    signals: dict[str, QueueSignal] = {}
    for qid, name, limit, ready, running, dead, flaky in rows:
        signals[qid] = QueueSignal(
            queue_id=qid,
            queue_name=name,
            concurrency_limit=limit,
            ready=ready,
            running=running,
            dead=dead,
            flaky=flaky,
        )

    attempts = conn.execute(
        """
        SELECT j.queue_id,
               count(*) FILTER (WHERE a.status = 'succeeded') AS succeeded,
               count(*) FILTER (WHERE a.status = 'failed')    AS failed
          FROM job_attempts a
          JOIN jobs j ON j.id = a.job_id
         WHERE j.org_id = %s
           AND a.finished_at >= now() - make_interval(hours => %s)
         GROUP BY j.queue_id
        """,
        (org_id, hours),
    ).fetchall()
    for qid, succeeded, failed in attempts:
        if qid in signals:
            signals[qid].succeeded_24h = succeeded
            signals[qid].failed_24h = failed

    errors = conn.execute(
        """
        SELECT j.queue_id, a.error
          FROM job_attempts a
          JOIN jobs j ON j.id = a.job_id
         WHERE j.org_id = %s
           AND a.status = 'failed' AND a.error IS NOT NULL
           AND a.finished_at >= now() - make_interval(hours => %s)
        """,
        (org_id, hours),
    ).fetchall()
    by_queue: dict[str, list[str]] = {}
    for qid, error in errors:
        by_queue.setdefault(qid, []).append(error)
    for qid, errs in by_queue.items():
        if qid in signals:
            label, share = dominant_error(errs)
            signals[qid].dominant_error = label
            signals[qid].dominant_error_share = share

    return list(signals.values())


def distinct_org_ids(conn: psycopg.Connection) -> list[str]:
    rows = conn.execute("SELECT id FROM orgs").fetchall()
    return [r[0] for r in rows]
