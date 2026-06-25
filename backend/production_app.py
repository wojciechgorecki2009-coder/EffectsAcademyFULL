import logging
import os

import stripe
from fastapi import Request
from fastapi.responses import JSONResponse

from server import FRONTEND_URL, app


def billing_error_response(status_code: int, detail: str, request: Request) -> JSONResponse:
    response = JSONResponse(status_code=status_code, content={"detail": detail})
    allowed_origins = {
        origin.strip().rstrip("/")
        for origin in os.environ.get("CORS_ORIGINS", FRONTEND_URL).split(",")
        if origin.strip()
    }
    origin = (request.headers.get("origin") or "").rstrip("/")
    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response


@app.middleware("http")
async def billing_error_responses(request: Request, call_next):
    try:
        return await call_next(request)
    except stripe.error.StripeError as exc:
        if request.url.path.startswith("/api/billing/"):
            message = getattr(exc, "user_message", None) or str(exc)
            logging.exception("Stripe billing request failed")
            return billing_error_response(
                400,
                f"Stripe Checkout error: {message}",
                request,
            )
        raise
    except Exception:
        if request.url.path.startswith("/api/billing/"):
            logging.exception("Billing request failed")
            return billing_error_response(
                500,
                "Checkout failed on the server. Open the Render API logs for the exact error, or check Stripe keys and price ID.",
                request,
            )
        raise
