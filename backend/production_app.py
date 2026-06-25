import asyncio
import logging
import mimetypes
import os
import re
from pathlib import Path
from typing import Optional

import stripe
from fastapi import HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.routing import APIRoute

import server
from server import FRONTEND_URL, app


AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"}


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


def is_audio_upload(filename: str, media_type: str = "") -> bool:
    ext = Path(filename).suffix.lower()
    return ext in AUDIO_EXTENSIONS or media_type.startswith("audio/")


async def stream_s3_audio(filename: str, request: Request, download: int = 0, name: Optional[str] = None):
    media_type, _ = mimetypes.guess_type(filename)
    media_type = media_type or "application/octet-stream"
    try:
        head = await asyncio.to_thread(
            server.s3.head_object,
            Bucket=server.S3_BUCKET,
            Key=filename,
        )
    except Exception:
        logging.exception("Object storage audio lookup failed")
        raise HTTPException(status_code=404, detail="File not found")

    file_size = int(head.get("ContentLength") or 0)
    content_type = head.get("ContentType") or media_type
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
    }
    if download:
        safe = (name or filename).replace('"', "")
        headers["Content-Disposition"] = f'attachment; filename="{safe}"'

    range_header = request.headers.get("range") or request.headers.get("Range")
    get_params = {"Bucket": server.S3_BUCKET, "Key": filename}
    status_code = 200

    if range_header:
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if match:
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else file_size - 1
            end = min(end, file_size - 1)
            if start > end or start >= file_size:
                raise HTTPException(status_code=416, detail="Invalid range")
            get_params["Range"] = f"bytes={start}-{end}"
            headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
            headers["Content-Length"] = str(end - start + 1)
            status_code = 206
        else:
            headers["Content-Length"] = str(file_size)
    else:
        headers["Content-Length"] = str(file_size)

    try:
        obj = await asyncio.to_thread(server.s3.get_object, **get_params)
    except Exception:
        logging.exception("Object storage audio download failed")
        raise HTTPException(status_code=404, detail="File not found")

    body = obj["Body"]

    async def iter_body():
        try:
            while True:
                chunk = await asyncio.to_thread(body.read, 64 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            await asyncio.to_thread(body.close)

    return StreamingResponse(
        iter_body(),
        status_code=status_code,
        headers=headers,
        media_type=content_type,
    )


async def serve_upload_with_audio_proxy(
    request: Request,
    filename: str,
    download: int = 0,
    name: Optional[str] = None,
):
    if Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    asset = await server.db.assets.find_one(
        {"file_url": f"/api/uploads/{filename}"},
        {"_id": 0},
    )
    if asset:
        await server.require_asset_access(request, asset)

    media_type, _ = mimetypes.guess_type(filename)
    media_type = media_type or "application/octet-stream"
    is_audio = is_audio_upload(filename, media_type)

    if server.USE_OBJECT_STORAGE:
        # Browsers need CORS + byte-range support for audio playback and client-side slowed exports.
        # R2 public redirects can be missing CORS, so audio is proxied through the API instead.
        if is_audio:
            return await stream_s3_audio(filename, request, download=download, name=name)

        if server.S3_PUBLIC_BASE_URL and (not asset or asset.get("category") != "Premium"):
            return RedirectResponse(f"{server.S3_PUBLIC_BASE_URL}/{filename}", status_code=307)
        try:
            url = await asyncio.to_thread(
                server.s3.generate_presigned_url,
                "get_object",
                Params={
                    "Bucket": server.S3_BUCKET,
                    "Key": filename,
                    **({"ResponseContentDisposition": f'attachment; filename="{(name or filename).replace(chr(34), "")}"'} if download else {}),
                },
                ExpiresIn=900,
            )
        except Exception:
            logging.exception("Object storage download failed")
            raise HTTPException(status_code=404, detail="File not found")
        return RedirectResponse(url, status_code=307)

    file_path = server.UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    file_size = file_path.stat().st_size
    headers: dict = {"Accept-Ranges": "bytes"}
    if download:
        safe = (name or filename).replace('"', "")
        headers["Content-Disposition"] = f'attachment; filename="{safe}"'

    range_header = request.headers.get("range") or request.headers.get("Range")
    if range_header:
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if match:
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else file_size - 1
            end = min(end, file_size - 1)
            if start > end:
                raise HTTPException(status_code=416, detail="Invalid range")
            length = end - start + 1

            def stream_range():
                with open(file_path, "rb") as f:
                    f.seek(start)
                    remaining = length
                    chunk_size = 64 * 1024
                    while remaining > 0:
                        data = f.read(min(chunk_size, remaining))
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            headers.update({
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(length),
            })
            return StreamingResponse(
                stream_range(),
                status_code=206,
                headers=headers,
                media_type=media_type,
            )

    return FileResponse(file_path, headers=headers, media_type=media_type)


def replace_route(path: str, method: str, endpoint) -> None:
    replacement = APIRoute(path=path, endpoint=endpoint, methods=[method])
    for index, route in enumerate(app.router.routes):
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            app.router.routes[index] = replacement
            return
    app.router.routes.insert(0, replacement)


replace_route("/api/billing/create-checkout-session", "POST", create_checkout_session_with_price_fallback)
replace_route("/api/uploads/{filename}", "GET", serve_upload_with_audio_proxy)


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
