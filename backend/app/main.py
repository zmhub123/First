import sqlite3
import logging
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("mario-backend")

app = FastAPI(
    title="FastAPI Backend",
    description="Starter backend framework for React frontend integration",
    version="0.1.0",
)

DB_PATH = Path(__file__).resolve().parent / "mario.db"


class SaveStateIn(BaseModel):
    level: int = Field(ge=1)
    lives: int = Field(ge=0)
    coins: int = Field(ge=0)


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS save_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                level INTEGER NOT NULL,
                lives INTEGER NOT NULL,
                coins INTEGER NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.commit()
    logger.info("SQLite initialized at path=%s", DB_PATH)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    started_at = time.perf_counter()
    client = request.client.host if request.client else "unknown"
    logger.info("request:start method=%s path=%s client=%s", request.method, request.url.path, client)
    try:
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.info(
            "request:end method=%s path=%s status=%s elapsed_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response
    except Exception:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.exception(
            "request:error method=%s path=%s elapsed_ms=%.2f",
            request.method,
            request.url.path,
            elapsed_ms,
        )
        raise


@app.get("/")
def root() -> dict:
    logger.info("service root checked")
    return {"service": "backend", "status": "running"}


@app.get("/api/health")
def health() -> dict:
    logger.info("health endpoint called")
    return {"ok": True, "service": "fastapi"}


@app.get("/api/message")
def message() -> dict:
    logger.info("message endpoint called")
    return {"message": "Hello from FastAPI!", "version": app.version}


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    logger.info("startup completed")


@app.get("/api/game/save")
def get_save_state() -> dict:
    logger.info("save:load requested")
    with get_connection() as connection:
        row = connection.execute(
            "SELECT level, lives, coins, updated_at FROM save_state WHERE id = 1"
        ).fetchone()

    if row is None:
        logger.info("save:load result=not_found")
        return {"exists": False, "state": None}

    logger.info(
        "save:load result=found level=%s lives=%s coins=%s updated_at=%s",
        row["level"],
        row["lives"],
        row["coins"],
        row["updated_at"],
    )
    return {
        "exists": True,
        "state": {
            "level": row["level"],
            "lives": row["lives"],
            "coins": row["coins"],
            "updated_at": row["updated_at"],
        },
    }


@app.post("/api/game/save")
def save_game_state(payload: SaveStateIn) -> dict:
    logger.info(
        "save:write requested level=%s lives=%s coins=%s",
        payload.level,
        payload.lives,
        payload.coins,
    )
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO save_state (id, level, lives, coins, updated_at)
            VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                level=excluded.level,
                lives=excluded.lives,
                coins=excluded.coins,
                updated_at=CURRENT_TIMESTAMP
            """,
            (payload.level, payload.lives, payload.coins),
        )
        connection.commit()
    logger.info("save:write completed")

    return {"ok": True}
