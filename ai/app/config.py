"""Environment configuration for the AI advisory service."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self) -> None:
        # Validated lazily (see database_url) so importing this module never
        # crashes — unit tests and `--help` don't need a database.
        self._database_url = os.getenv("DATABASE_URL")
        # Claude is used when a key is present; otherwise a deterministic
        # template generates advisory text so the pipeline still runs.
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY") or None
        self.model = os.getenv("AI_MODEL", "claude-opus-4-8")
        self.port = int(os.getenv("AI_PORT", "8000"))
        self.analyze_interval_seconds = int(
            os.getenv("ANALYZE_INTERVAL_SECONDS", "300")
        )
        self.lookback_hours = int(os.getenv("ADVISORY_LOOKBACK_HOURS", "24"))
        # pgvector cosine distance below which two advisories are duplicates.
        self.dedup_distance = float(os.getenv("ADVISORY_DEDUP_DISTANCE", "0.12"))

    @property
    def uses_claude(self) -> bool:
        return self.anthropic_api_key is not None

    @property
    def database_url(self) -> str:
        if not self._database_url:
            raise RuntimeError("DATABASE_URL is required")
        return self._database_url


settings = Settings()
