import logging

import stripe
from fastapi import Request
from fastapi.responses import JSONResponse

from server import app


@app.middleware("http")
async def billing_error_responses(request: Request, call_next):
    try:
        return await call_next(request)
    except stripe.error.StripeError as exc:
        if request.url.path.startswith("/api/billing/"):
            message = getattr(exc, "user_message", None) or str(exc)
            logging.exception("Stripe billing request failed")
            return JSONResponse(
                status_code=400,
                content={"detail": f"Stripe Checkout error: {message}"},
            )
        raise
    except Exception:
        if request.url.path.startswith("/api/billing/"):
            logging.exception("Billing request failed")
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Checkout failed on the server. Open the Render API logs for the exact error, or check Stripe keys and price ID."
                },
            )
        raise
