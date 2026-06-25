import logging
import os

import stripe
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

import server
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


def premium_line_item(use_configured_price: bool = True) -> dict:
    if use_configured_price and server.STRIPE_PRICE_ID:
        return {"price": server.STRIPE_PRICE_ID, "quantity": 1}
    return {
        "price_data": {
            "currency": "usd",
            "unit_amount": 499,
            "recurring": {"interval": "month"},
            "product_data": {"name": "Effects Academy Premium"},
        },
        "quantity": 1,
    }


async def create_checkout_session_with_price_fallback(request: Request):
    server.enforce_rate_limit(request, "checkout", limit=10, window_seconds=300)
    user = await server.request_user(request, required=True)
    if server.has_premium_access(user):
        return {"url": f"{server.FRONTEND_URL}/premium?already_subscribed=1"}
    if not server.STRIPE_SECRET_KEY:
        if server.USE_MOCK_DB:
            return {"url": f"{server.FRONTEND_URL}/premium?checkout=configuration-required", "demo": True}
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    checkout_params = {
        "mode": "subscription",
        "client_reference_id": user["id"],
        "line_items": [premium_line_item(True)],
        "metadata": {"user_id": user["id"]},
        "subscription_data": {"metadata": {"user_id": user["id"]}},
        "success_url": f"{server.FRONTEND_URL}/premium?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{server.FRONTEND_URL}/premium?checkout=cancelled",
        "allow_promotion_codes": True,
        "billing_address_collection": "required",
    }

    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.get("email") or None,
            name=user.get("name") or None,
            metadata={"user_id": user["id"]},
        )
        customer_id = customer.id
        await server.db.users.update_one(
            {"id": user["id"]},
            {"$set": {"stripe_customer_id": customer_id, "updated_at": server.now_iso()}},
        )
    checkout_params["customer"] = customer_id

    try:
        session = stripe.checkout.Session.create(**checkout_params)
    except stripe.error.InvalidRequestError as exc:
        message = getattr(exc, "user_message", None) or str(exc)
        if server.STRIPE_PRICE_ID and "No such price" in message:
            logging.warning("Configured Stripe price was unavailable; falling back to inline premium price data")
            checkout_params["line_items"] = [premium_line_item(False)]
            session = stripe.checkout.Session.create(**checkout_params)
        else:
            raise
    return {"url": session.url}


def replace_checkout_route() -> None:
    replacement = APIRoute(
        path="/api/billing/create-checkout-session",
        endpoint=create_checkout_session_with_price_fallback,
        methods=["POST"],
    )
    for index, route in enumerate(app.router.routes):
        if getattr(route, "path", None) == "/api/billing/create-checkout-session" and "POST" in getattr(route, "methods", set()):
            app.router.routes[index] = replacement
            return
    app.router.routes.insert(0, replacement)


replace_checkout_route()


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
