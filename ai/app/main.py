"""FastAPI entrypoint for the AI advisory service.

Runs a background loop that periodically analyzes failures and writes advisories,
plus a POST /analyze trigger and a GET /health probe. It is advisory and
asynchronous — the core scheduler runs correctly with this service switched off.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .analyzer import analyze_all
from .config import settings
from .db import ping

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ai")


async def _loop() -> None:
    while True:
        try:
            result = await asyncio.to_thread(analyze_all)
            if result["created"]:
                log.info(
                    "Wrote %d advisories (%d findings examined)",
                    result["created"],
                    result["findings"],
                )
        except Exception as exc:  # noqa: BLE001
            log.error("Analysis pass failed: %s", exc)
        await asyncio.sleep(settings.analyze_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "AI advisory service starting (model=%s, groq=%s, interval=%ss)",
        settings.model,
        settings.uses_groq,
        settings.analyze_interval_seconds,
    )
    task = asyncio.create_task(_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(title="Ballast AI Advisory", lifespan=lifespan)


@app.get("/health")
def health() -> JSONResponse:
    ok = ping()
    return JSONResponse(
        {
            "status": "ok" if ok else "error",
            "db": "up" if ok else "down",
            "groq": settings.uses_groq,
        },
        status_code=200 if ok else 503,
    )


@app.post("/analyze")
async def analyze() -> dict:
    """Run one analysis pass now and report what was written."""
    return await asyncio.to_thread(analyze_all)
