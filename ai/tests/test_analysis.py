"""Unit tests for the pure analysis logic (no database, no network)."""

from app.detectors import detect
from app.signals import QueueSignal, dominant_error


def test_dominant_error_normalizes_volatile_numbers():
    errors = [
        "Timeout after 30000ms",
        "Timeout after 45000ms",
        "ECONNRESET",
    ]
    label, share = dominant_error(errors)
    assert label == "Timeout after Nms"
    assert round(share, 2) == 0.67


def test_dominant_error_empty():
    assert dominant_error([]) == (None, 0.0)


def _queue(**kw) -> QueueSignal:
    base = dict(queue_id="q1", queue_name="default", concurrency_limit=10)
    base.update(kw)
    return QueueSignal(**base)


def test_detects_dead_letter_anomaly():
    findings = detect([_queue(dead=4, dominant_error="Simulated failure",
                              dominant_error_share=1.0)])
    kinds = [f.kind for f in findings]
    assert "anomaly" in kinds
    anomaly = next(f for f in findings if f.kind == "anomaly")
    assert anomaly.severity == "warning"


def test_detects_capacity_backlog():
    findings = detect([_queue(ready=25, concurrency_limit=10)])
    assert any(f.kind == "capacity" for f in findings)


def test_detects_retry_waste():
    findings = detect([_queue(succeeded_24h=2, failed_24h=8)])
    assert any(f.kind == "retry_tuning" for f in findings)


def test_healthy_queue_yields_no_findings():
    findings = detect([_queue(ready=1, running=1, succeeded_24h=50, failed_24h=1)])
    assert findings == []
