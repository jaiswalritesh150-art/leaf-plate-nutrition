from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import get_settings

_pool: ConnectionPool | None = None


def init_pool() -> None:
    global _pool
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not set. See .env.example.")
    # prepare_threshold=None: required for Supabase's transaction pooler (pgbouncer),
    # which does not support server-side prepared statements.
    _pool = ConnectionPool(
        url,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row, "prepare_threshold": None},
        open=True,
        timeout=15,
    )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def connection():
    if _pool is None:
        init_pool()
    assert _pool is not None
    with _pool.connection() as conn:  # commits on success, rolls back on error
        yield conn
