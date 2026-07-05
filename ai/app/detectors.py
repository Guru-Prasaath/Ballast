"""Turns raw queue signals into findings worth advising on. Deterministic and
explainable — the AI writes the recommendation, but the *decision* to raise an
advisory is rule-based, so the system behaves predictably."""

from __future__ import annotations

from dataclasses import dataclass, field

from .signals import QueueSignal

AdvisoryKind = str  # retry_tuning | flaky_detection | anomaly | capacity
Severity = str  # info | warning | critical


@dataclass
class Finding:
    kind: AdvisoryKind
    severity: Severity
    queue_id: str
    queue_name: str
    headline: str
    evidence: dict = field(default_factory=dict)


def detect(signals: list[QueueSignal]) -> list[Finding]:
    findings: list[Finding] = []

    for s in signals:
        # Dead-letter anomaly: jobs exhausting retries with a dominant error.
        if s.dead >= 3:
            findings.append(
                Finding(
                    kind="anomaly",
                    severity="critical" if s.dead >= 10 else "warning",
                    queue_id=s.queue_id,
                    queue_name=s.queue_name,
                    headline=(
                        f"{s.dead} jobs on '{s.queue_name}' dead-lettered"
                        + (
                            f", {round(s.dominant_error_share * 100)}% with "
                            f'"{s.dominant_error}"'
                            if s.dominant_error
                            else ""
                        )
                    ),
                    evidence={
                        "dead": s.dead,
                        "dominant_error": s.dominant_error,
                        "dominant_error_share": round(s.dominant_error_share, 2),
                    },
                )
            )

        # Flaky: jobs that repeatedly succeed only after retrying.
        if s.flaky >= 3:
            findings.append(
                Finding(
                    kind="flaky_detection",
                    severity="warning",
                    queue_id=s.queue_id,
                    queue_name=s.queue_name,
                    headline=(
                        f"{s.flaky} jobs on '{s.queue_name}' succeeded only "
                        "after retrying"
                    ),
                    evidence={"flaky": s.flaky},
                )
            )

        # Retry waste: a large share of attempts are failing.
        if s.attempts_24h >= 5 and s.failure_rate_24h >= 0.4:
            findings.append(
                Finding(
                    kind="retry_tuning",
                    severity="warning",
                    queue_id=s.queue_id,
                    queue_name=s.queue_name,
                    headline=(
                        f"{round(s.failure_rate_24h * 100)}% of attempts on "
                        f"'{s.queue_name}' are failing"
                    ),
                    evidence={
                        "failure_rate": round(s.failure_rate_24h, 2),
                        "failed": s.failed_24h,
                        "succeeded": s.succeeded_24h,
                        "dominant_error": s.dominant_error,
                    },
                )
            )

        # Capacity: backlog exceeds what the queue can run concurrently.
        if s.ready >= 5 and s.ready > s.concurrency_limit:
            findings.append(
                Finding(
                    kind="capacity",
                    severity="warning",
                    queue_id=s.queue_id,
                    queue_name=s.queue_name,
                    headline=(
                        f"'{s.queue_name}' has {s.ready} ready jobs but a "
                        f"concurrency limit of {s.concurrency_limit}"
                    ),
                    evidence={
                        "ready": s.ready,
                        "concurrency_limit": s.concurrency_limit,
                    },
                )
            )

    return findings
