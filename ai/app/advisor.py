"""Turns a finding into a human-readable advisory. Uses Claude when
ANTHROPIC_API_KEY is set; otherwise a deterministic template keeps the pipeline
working end-to-end without a key."""

from __future__ import annotations

import logging

from pydantic import BaseModel, Field

from .config import settings
from .detectors import Finding

log = logging.getLogger("ai.advisor")

_SYSTEM = (
    "You are a site-reliability advisor for Ballast, a distributed job "
    "scheduler. You are given a detected problem on a job queue with evidence. "
    "Write a short, concrete recommendation an operator can act on. Reference "
    "real levers: the queue's retry policy (backoff strategy, baseDelayMs, "
    "jitter, maxAttempts), its concurrency limit, adding workers, or a circuit "
    "breaker on a flaky dependency. Be specific and non-generic. You are "
    "advisory only — never imply you can change anything automatically."
)


class AdvisoryDraft(BaseModel):
    title: str = Field(description="A concise headline, at most 80 characters")
    summary: str = Field(description="1-2 sentences on what is happening")
    recommendation: str = Field(
        description="A specific, actionable fix referencing concrete levers"
    )
    confidence: float = Field(description="0..1 confidence in the recommendation")


def draft_advisory(finding: Finding) -> AdvisoryDraft:
    if settings.uses_claude:
        try:
            return _draft_with_claude(finding)
        except Exception as exc:  # noqa: BLE001 - fall back, never crash the loop
            log.warning("Claude advisory generation failed: %s", exc)
    return _draft_with_template(finding)


def _draft_with_claude(finding: Finding) -> AdvisoryDraft:
    from anthropic import Anthropic

    client = Anthropic(api_key=settings.anthropic_api_key)
    prompt = (
        f"Problem type: {finding.kind}\n"
        f"Severity: {finding.severity}\n"
        f"Queue: {finding.queue_name}\n"
        f"Observation: {finding.headline}\n"
        f"Evidence: {finding.evidence}\n\n"
        "Produce an advisory for this."
    )
    resp = client.messages.parse(
        model=settings.model,
        max_tokens=1024,
        system=_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        output_format=AdvisoryDraft,
    )
    draft = resp.parsed_output
    if draft is None:  # refusal or unparseable
        raise RuntimeError("no parsed output")
    return draft


def _draft_with_template(finding: Finding) -> AdvisoryDraft:
    ev = finding.evidence
    queue = finding.queue_name

    if finding.kind == "anomaly":
        err = ev.get("dominant_error")
        rec = (
            "Investigate the dominant failure and consider a circuit breaker on "
            "the failing dependency. If the errors are transient, add jitter and "
            "raise baseDelayMs on the queue's retry policy so retries spread out."
        )
        summary = (
            f"{ev.get('dead', 0)} jobs on '{queue}' exhausted their retries"
            + (f', {round(ev.get("dominant_error_share", 0) * 100)}% failing with "{err}".' if err else ".")
        )
    elif finding.kind == "flaky_detection":
        rec = (
            "These jobs succeed on retry, so the fault is transient. Add jitter "
            "to the retry policy and consider a small baseDelayMs bump to cut "
            "wasted first attempts."
        )
        summary = (
            f"{ev.get('flaky', 0)} jobs on '{queue}' are succeeding only after "
            "one or more retries."
        )
    elif finding.kind == "retry_tuning":
        rec = (
            "Raise baseDelayMs and enable jitter on the retry policy to reduce "
            "retry storms, and verify maxAttempts isn't masking a hard failure."
        )
        summary = (
            f"{round(ev.get('failure_rate', 0) * 100)}% of attempts on '{queue}' "
            f"are failing ({ev.get('failed', 0)} failed vs "
            f"{ev.get('succeeded', 0)} succeeded)."
        )
    else:  # capacity
        rec = (
            f"Add one or two workers subscribed to '{queue}', or raise its "
            f"concurrency limit above {ev.get('concurrency_limit', 0)} to clear "
            "the backlog."
        )
        summary = (
            f"'{queue}' has {ev.get('ready', 0)} ready jobs but a concurrency "
            f"limit of {ev.get('concurrency_limit', 0)}."
        )

    return AdvisoryDraft(
        title=finding.headline[:80],
        summary=summary,
        recommendation=rec,
        confidence=0.6,
    )
