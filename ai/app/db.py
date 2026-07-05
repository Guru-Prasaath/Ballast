"""Database access for the AI service. Reads job/attempt data and writes
advisories to the same Postgres the core uses."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

import psycopg

from .config import settings


@contextmanager
def get_conn() -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(settings.database_url, autocommit=False)
    try:
        yield conn
    finally:
        conn.close()


def ping() -> bool:
    """Cheap connectivity check for the health endpoint."""
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False
