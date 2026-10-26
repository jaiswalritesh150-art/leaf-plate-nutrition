from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, fields: dict | None = None):
        self.status, self.code, self.message, self.fields = status, code, message, fields or {}


def body(code: str, message: str, fields: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "fields": fields or {}}}


async def api_error_handler(_: Request, exc: ApiError):
    return JSONResponse(status_code=exc.status, content=body(exc.code, exc.message, exc.fields))


async def validation_handler(_: Request, exc: RequestValidationError):
    fields: dict[str, str] = {}
    for err in exc.errors():
        loc = [str(p) for p in err["loc"] if p not in ("body", "query")]
        msg = err["msg"].removeprefix("Value error, ")
        fields.setdefault(".".join(loc) or "request", msg)
    return JSONResponse(
        status_code=422,
        content=body("validation_error", "Please check the highlighted fields.", fields),
    )
