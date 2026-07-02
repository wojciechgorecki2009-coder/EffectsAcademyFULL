from fastapi import FastAPI, APIRouter, HTTPException, Header, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import shutil
import uuid
import re
import mimetypes
import asyncio
import smtplib
import ssl
import time
import requests
import io
import secrets
import base64
from collections import defaultdict, deque
from email.message import EmailMessage
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone
from PIL import Image, ImageOps, UnidentifiedImageError
import jwt
import stripe
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

USE_MOCK_DB = os.environ.get("USE_MOCK_DB") == "1"
JWT_SECRET = os.environ.get("JWT_SECRET", "effects-academy-local-preview" if USE_MOCK_DB else "")
UPLOAD_PASSWORD = os.environ.get("UPLOAD_PASSWORD", "local-preview-only" if USE_MOCK_DB else "")
LOCAL_PREVIEW_UPLOAD_PASSWORDS = {UPLOAD_PASSWORD}
if USE_MOCK_DB:
    # Keep the original local uploader password working for preview/testing only.
    LOCAL_PREVIEW_UPLOAD_PASSWORDS.add("EffectsAcademy2026Base44")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:4173").rstrip("/")
GOOGLE_LOGIN_URI = os.environ.get(
    "GOOGLE_LOGIN_URI",
    f"{FRONTEND_URL}/api/auth/google/callback",
)
DMCA_TO_EMAIL = os.environ.get("DMCA_TO_EMAIL", "EffectsAcademy2026@hotmail.com")
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", SMTP_USERNAME)
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "1") == "1"
SMTP_USE_SSL = os.environ.get("SMTP_USE_SSL", "0") == "1"
UPLOADER_EMAILS = {item.strip().lower() for item in os.environ.get("UPLOADER_EMAILS", "").split(",") if item.strip()}
ADMIN_EMAILS = {item.strip().lower() for item in os.environ.get("ADMIN_EMAILS", "").split(",") if item.strip()}
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
S3_BUCKET = os.environ.get("S3_BUCKET", "")
S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL", "") or None
S3_REGION = os.environ.get("S3_REGION", "auto")
S3_ACCESS_KEY_ID = os.environ.get("S3_ACCESS_KEY_ID", "")
S3_SECRET_ACCESS_KEY = os.environ.get("S3_SECRET_ACCESS_KEY", "")
S3_PUBLIC_BASE_URL = os.environ.get("S3_PUBLIC_BASE_URL", "").rstrip("/")
USE_OBJECT_STORAGE = bool(S3_BUCKET and S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY)
FAL_KEY = os.environ.get("FAL_KEY", "")
FAL_IMAGE_FREE_MODEL = os.environ.get("FAL_IMAGE_FREE_MODEL", "fal-ai/nano-banana/edit")
FAL_IMAGE_PREMIUM_MODEL = os.environ.get("FAL_IMAGE_PREMIUM_MODEL", "fal-ai/nano-banana/edit")
FAL_IMAGE_OUTPUT_FORMAT = os.environ.get("FAL_IMAGE_OUTPUT_FORMAT", "png").lower()
FAL_IMAGE_ASPECT_RATIO = os.environ.get("FAL_IMAGE_ASPECT_RATIO", "auto")
FAL_IMAGE_PREMIUM_RESOLUTION = os.environ.get("FAL_IMAGE_PREMIUM_RESOLUTION", "1K")
FAL_IMAGE_SAFETY_TOLERANCE = os.environ.get("FAL_IMAGE_SAFETY_TOLERANCE", "4")
FAL_IMAGE_MAX_DIMENSION = int(os.environ.get("FAL_IMAGE_MAX_DIMENSION", "1024"))
FAL_IMAGE_JPEG_QUALITY = int(os.environ.get("FAL_IMAGE_JPEG_QUALITY", "85"))
FAL_QUEUE_BASE_URL = os.environ.get("FAL_QUEUE_BASE_URL", "https://queue.fal.run").rstrip("/")
FAL_STATUS_POLL_SECONDS = float(os.environ.get("FAL_STATUS_POLL_SECONDS", "1.5"))
FAL_STATUS_MAX_POLLS = int(os.environ.get("FAL_STATUS_MAX_POLLS", "80"))
AI_IMAGE_MAX_BYTES = int(os.environ.get("AI_IMAGE_MAX_BYTES", str(8 * 1024 * 1024)))
PREMIUM_DOWNLOAD_LINK_TTL_SECONDS = int(os.environ.get("PREMIUM_DOWNLOAD_LINK_TTL_SECONDS", str(10 * 60)))

s3 = None
if USE_OBJECT_STORAGE:
    import boto3
    from botocore.client import Config as BotoConfig

    s3 = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        region_name=S3_REGION,
        aws_access_key_id=S3_ACCESS_KEY_ID,
        aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        config=BotoConfig(signature_version="s3v4"),
    )

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

if USE_MOCK_DB:
    from mongomock_motor import AsyncMongoMockClient

    client = AsyncMongoMockClient()
    db = client[os.environ.get("DB_NAME", "effects_academy_local")]
else:
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
RATE_LIMITS = defaultdict(deque)


def require_env(name: str, value: str) -> None:
    if not value:
        raise RuntimeError(f"{name} must be configured outside local preview mode")


if not USE_MOCK_DB:
    require_env("JWT_SECRET", JWT_SECRET)
    require_env("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID)
    require_env("FRONTEND_URL", FRONTEND_URL)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def enforce_rate_limit(request: Request, bucket: str, limit: int = 5, window_seconds: int = 300) -> None:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",", 1)[0].strip() or request.client.host if request.client else "unknown"
    key = f"{bucket}:{ip}"
    current = time.time()
    hits = RATE_LIMITS[key]
    while hits and current - hits[0] > window_seconds:
        hits.popleft()
    if len(hits) >= limit:
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a few minutes and try again.")
    hits.append(current)


def role_for_email(email: str, existing_role: str = "Viewer") -> str:
    normalized = (email or "").strip().lower()
    if normalized in ADMIN_EMAILS:
        return "Admin"
    if normalized in UPLOADER_EMAILS:
        return "Uploader"
    return existing_role if existing_role in {"Admin", "Uploader", "Viewer"} else "Viewer"


def create_session_token(user_id: str) -> str:
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail="JWT_SECRET is not configured")
    payload = {
        "sub": user_id,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(datetime.now(timezone.utc).timestamp()) + 60 * 60 * 24 * 30,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "picture": user.get("picture", ""),
        "role": user.get("role", "Viewer"),
        "premium_status": user.get("premium_status", "inactive"),
    }


async def sync_user_from_stripe(user: dict) -> dict:
    if not STRIPE_SECRET_KEY or not user.get("id"):
        return user
    try:
        customer_id = user.get("stripe_customer_id", "")
        if not customer_id:
            escaped_user_id = user["id"].replace("'", "\\'")
            customers = stripe.Customer.search(
                query=f"metadata['user_id']:'{escaped_user_id}'",
                limit=1,
            )
            if customers.data:
                customer_id = customers.data[0].id
        if not customer_id:
            return user
        subscriptions = stripe.Subscription.list(customer=customer_id, status="all", limit=20)
        active_subscription = next(
            (item for item in subscriptions.data if item.status in {"active", "trialing"}),
            None,
        )
        updates = {
            "stripe_customer_id": customer_id,
            "premium_status": active_subscription.status if active_subscription else "inactive",
            "stripe_subscription_id": active_subscription.id if active_subscription else "",
            "updated_at": now_iso(),
        }
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
        return {**user, **updates}
    except stripe.error.StripeError:
        logging.exception("Unable to reconcile Stripe customer for %s", user.get("id"))
        return user


async def request_user(request: Request, required: bool = False) -> Optional[dict]:
    authorization = request.headers.get("authorization", "")
    token = ""
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        token = request.query_params.get("access_token", "")
    if not token:
        if required:
            raise HTTPException(status_code=401, detail="Sign in required")
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        if required:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return None
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user and required:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def has_premium_access(user: Optional[dict]) -> bool:
    if not user:
        return False
    return user.get("role") in {"Admin", "Uploader"} or user.get("premium_status") in {"active", "trialing"}


def can_manage_assets(user: Optional[dict]) -> bool:
    return bool(user and user.get("role") in {"Admin", "Uploader"})


def ai_generation_limit(user: dict) -> Optional[int]:
    if user.get("role") in {"Admin", "Uploader"}:
        return None
    if user.get("premium_status") in {"active", "trialing"}:
        return 10
    return 3


def ai_image_settings_for_user(user: dict) -> dict:
    premium_tier = has_premium_access(user)
    model = FAL_IMAGE_PREMIUM_MODEL if premium_tier else FAL_IMAGE_FREE_MODEL
    return {
        "provider": "fal",
        "model": model,
        "resolution": FAL_IMAGE_PREMIUM_RESOLUTION if "nano-banana-pro" in model else "",
        "tier": "premium" if premium_tier else "free",
    }


def ai_usage_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def ai_usage_for_user(user: dict) -> dict:
    usage_date = ai_usage_date()
    limit = ai_generation_limit(user)
    record_id = f"{user['id']}:{usage_date}"
    record = await db.ai_image_usage.find_one({"id": record_id}, {"_id": 0}) or {}
    used = int(record.get("used", 0))
    unlimited = limit is None
    image_settings = ai_image_settings_for_user(user)
    return {
        "date": usage_date,
        "used": used,
        "limit": limit,
        "remaining": None if unlimited else max(limit - used, 0),
        "unlimited": unlimited,
        "image_provider": image_settings["provider"],
        "image_model": image_settings["model"],
        "image_tier": image_settings["tier"],
    }


def prepare_fal_image_upload(image_bytes: bytes, content_type: str, filename: str) -> tuple[str, bytes, str]:
    """Resize and lightly compress uploaded images before Fal image edits.

    Fal accepts image URLs, including data URLs. Keeping uploads to a sane max
    dimension makes queue submissions faster and cheaper to process.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image)
    except UnidentifiedImageError:
        return (Path(filename or "image.png").name, image_bytes, content_type)

    if image.width > FAL_IMAGE_MAX_DIMENSION or image.height > FAL_IMAGE_MAX_DIMENSION:
        image.thumbnail((FAL_IMAGE_MAX_DIMENSION, FAL_IMAGE_MAX_DIMENSION), Image.Resampling.LANCZOS)

    has_alpha = image.mode in {"RGBA", "LA"} or ("transparency" in image.info)
    output = io.BytesIO()
    safe_stem = Path(filename or "image").stem or "image"
    if has_alpha:
        image = image.convert("RGBA")
        image.save(output, format="PNG", optimize=True)
        return (f"{safe_stem}.png", output.getvalue(), "image/png")

    image = image.convert("RGB")
    jpeg_quality = max(50, min(FAL_IMAGE_JPEG_QUALITY, 95))
    image.save(output, format="JPEG", quality=jpeg_quality, optimize=True, progressive=True)
    return (f"{safe_stem}.jpg", output.getvalue(), "image/jpeg")


def fal_error_message(payload, fallback: str = "Fal image edit failed") -> str:
    if isinstance(payload, dict):
        detail = payload.get("detail") or payload.get("error") or payload.get("message")
        if isinstance(detail, str):
            return detail
        if isinstance(detail, dict):
            return detail.get("message") or detail.get("detail") or fallback
        if isinstance(detail, list) and detail:
            first = detail[0]
            if isinstance(first, str):
                return first
            if isinstance(first, dict):
                return first.get("msg") or first.get("message") or fallback
    return fallback


def extract_fal_image_data(payload) -> tuple[str, str]:
    images = payload.get("images") or []
    if not images or not isinstance(images[0], dict):
        raise HTTPException(status_code=502, detail="Fal did not return an edited image")

    image_result = images[0]
    image_url = image_result.get("url", "")
    content_type = image_result.get("content_type") or f"image/{FAL_IMAGE_OUTPUT_FORMAT}"
    if image_url.startswith("data:"):
        header, encoded = image_url.split(",", 1)
        mime_match = re.match(r"data:([^;]+);base64", header)
        return encoded, mime_match.group(1) if mime_match else content_type
    if image_url.startswith(("http://", "https://")):
        response = requests.get(image_url, timeout=90)
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Fal returned an image URL that could not be downloaded")
        return base64.b64encode(response.content).decode("utf-8"), response.headers.get("content-type", content_type)

    raise HTTPException(status_code=502, detail="Fal did not return a usable image URL")


def base64_size_bytes(encoded: str) -> int:
    clean = re.sub(r"\s+", "", encoded or "")
    if not clean:
        return 0
    padding = len(clean) - len(clean.rstrip("="))
    return max(0, (len(clean) * 3) // 4 - padding)


async def require_uploader(request: Request) -> dict:
    user = await request_user(request)
    if user and user.get("role") in {"Admin", "Uploader"}:
        return user
    # The password compatibility path exists only for the local mock preview.
    if USE_MOCK_DB and request.headers.get("x-upload-password") in LOCAL_PREVIEW_UPLOAD_PASSWORDS:
        return {"id": "local:uploader", "role": "Uploader"}
    raise HTTPException(status_code=403, detail="Uploader or Admin account required")


async def require_admin(request: Request) -> dict:
    user = await request_user(request, required=True)
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin account required")
    return user


def dmca_email_configured() -> bool:
    return bool(SMTP_HOST and SMTP_FROM_EMAIL and DMCA_TO_EMAIL)


def _deliver_email(message: EmailMessage) -> None:
    context = ssl.create_default_context()
    if SMTP_USE_SSL:
        client = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20, context=context)
    else:
        client = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20)
    with client:
        client.ehlo()
        if SMTP_USE_TLS and not SMTP_USE_SSL:
            client.starttls(context=context)
            client.ehlo()
        if SMTP_USERNAME and SMTP_PASSWORD:
            client.login(SMTP_USERNAME, SMTP_PASSWORD)
        client.send_message(message)


def _send_dmca_email(submission: "ContactSubmission") -> None:
    subject_asset = re.sub(r"[\r\n]+", " ", submission.content_or_subject).strip()[:120]
    message = EmailMessage()
    message["Subject"] = f"DMCA removal request: {subject_asset}"
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = DMCA_TO_EMAIL
    message["Reply-To"] = submission.email
    message.set_content(
        "A new DMCA removal request was submitted to Effects Academy.\n\n"
        f"Submission ID: {submission.id}\n"
        f"Submitted: {submission.created_at}\n"
        f"Claimant: {submission.full_name}\n"
        f"Claimant email: {submission.email}\n"
        f"Content URL / asset: {submission.content_or_subject}\n\n"
        "Description of the claimed infringement:\n"
        f"{submission.description}\n"
    )
    _deliver_email(message)


def _send_suggestion_email(submission: "ContactSubmission") -> None:
    subject = re.sub(r"[\r\n]+", " ", submission.content_or_subject).strip()[:120]
    message = EmailMessage()
    message["Subject"] = f"Effects Academy suggestion: {subject}"
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = DMCA_TO_EMAIL
    message.set_content(
        "A new anonymous suggestion was submitted to Effects Academy.\n\n"
        f"Submission ID: {submission.id}\n"
        f"Submitted: {submission.created_at}\n"
        f"Subject: {submission.content_or_subject}\n\n"
        "Suggestion:\n"
        f"{submission.description}\n"
    )
    _deliver_email(message)


async def require_asset_access(request: Request, asset: dict):
    if asset.get("category") != "Premium":
        return
    user = await request_user(request)
    if user and user.get("role") in {"Admin", "Uploader"}:
        return
    uploader_password = request.headers.get("x-upload-password") or request.query_params.get("upload_password", "")
    if USE_MOCK_DB and uploader_password in LOCAL_PREVIEW_UPLOAD_PASSWORDS:
        return
    if not has_premium_access(user):
        raise HTTPException(status_code=402, detail="Premium subscription required")


# ---------- Models ----------
class Asset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    category: str  # Torrents | Project Files | Overlays | Audios | Sound FX | Presets | Premium
    creator_tag: Optional[str] = ""           # for Audios creator (MRBIT, IUSETHIS, ...) or any uploader name
    ae_version: Optional[str] = ""            # for Project Files
    bpm: Optional[str] = ""                   # for Audios
    genre: Optional[str] = ""                 # for Torrents/Audios
    show_group: Optional[str] = ""            # individual show name (The Boys, Dexter, ...)
    torrent_type: Optional[str] = ""          # "Show" | "Movie" for Torrents category
    thumbnail_url: Optional[str] = ""
    file_url: Optional[str] = ""              # internal /api/uploads/...
    original_filename: Optional[str] = ""     # original name to use when downloading
    external_url: Optional[str] = ""          # Drive/Mega/MediaFire link
    pack_id: Optional[str] = ""
    custom_category_id: Optional[str] = ""
    download_count: int = 0
    has_external_url: Optional[bool] = False
    created_at: str = Field(default_factory=now_iso)


class AssetCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    category: str
    creator_tag: Optional[str] = ""
    ae_version: Optional[str] = ""
    bpm: Optional[str] = ""
    genre: Optional[str] = ""
    show_group: Optional[str] = ""
    torrent_type: Optional[str] = ""
    thumbnail_url: Optional[str] = ""
    file_url: Optional[str] = ""
    original_filename: Optional[str] = ""
    external_url: Optional[str] = ""
    pack_id: Optional[str] = ""
    custom_category_id: Optional[str] = ""


class AssetUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    creator_tag: Optional[str] = None
    ae_version: Optional[str] = None
    bpm: Optional[str] = None
    genre: Optional[str] = None
    show_group: Optional[str] = None
    torrent_type: Optional[str] = None
    thumbnail_url: Optional[str] = None
    file_url: Optional[str] = None
    original_filename: Optional[str] = None
    external_url: Optional[str] = None
    pack_id: Optional[str] = None
    custom_category_id: Optional[str] = None


class Pack(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str
    description: Optional[str] = ""
    thumbnail_url: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class PackCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = ""
    thumbnail_url: Optional[str] = ""


class CustomCategory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    color: str = "#00F0FF"
    thumbnail_url: Optional[str] = ""
    parent_category: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class CustomCategoryCreate(BaseModel):
    name: str
    color: str = "#00F0FF"
    thumbnail_url: Optional[str] = ""
    parent_category: Optional[str] = ""


class ContactSubmission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: str  # dmca | suggestion
    full_name: str
    email: str
    content_or_subject: str
    description: str
    created_at: str = Field(default_factory=now_iso)


class ContactCreate(BaseModel):
    full_name: str
    email: EmailStr
    content_or_subject: str
    description: str


class SuggestionCreate(BaseModel):
    content_or_subject: str
    description: str


class PremiumDownloadLink(BaseModel):
    url: str
    token: str
    expires_at: int
    expires_in_seconds: int


class CategoryOverride(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: str  # "show" | "creator"
    name: str
    image_url: Optional[str] = ""
    color_from: Optional[str] = ""
    color_to: Optional[str] = ""
    accent: Optional[str] = ""
    text_color: Optional[str] = ""
    blur_px: Optional[float] = None  # null = use default; 0 = sharp; >0 = blurred
    deleted: bool = False
    updated_at: str = Field(default_factory=now_iso)


class CategoryOverrideUpsert(BaseModel):
    image_url: Optional[str] = None
    color_from: Optional[str] = None
    color_to: Optional[str] = None
    accent: Optional[str] = None
    text_color: Optional[str] = None
    blur_px: Optional[float] = None
    deleted: Optional[bool] = None


class PasswordCheck(BaseModel):
    password: str


class GoogleCredential(BaseModel):
    credential: str


class DevLoginRequest(BaseModel):
    premium: bool = False


class CheckoutConfirmation(BaseModel):
    session_id: str


class RoleUpdate(BaseModel):
    role: str


class AiImageEditResponse(BaseModel):
    image_base64: str
    mime_type: str = "image/png"
    used: int
    limit: Optional[int] = None
    remaining: Optional[int] = None
    unlimited: bool = False
    image_provider: Optional[str] = None
    image_model: Optional[str] = None
    image_tier: Optional[str] = None
    storage_saved: Optional[bool] = False
    storage_item_id: Optional[str] = None


class AiImageStorageItem(BaseModel):
    id: str
    image_base64: str
    mime_type: str = "image/png"
    replacement_text: str
    style_notes: Optional[str] = ""
    image_provider: Optional[str] = None
    image_model: Optional[str] = None
    image_tier: Optional[str] = None
    size_bytes: int = 0
    created_at: str


class AiImageStorageResponse(BaseModel):
    available: bool
    total_bytes: int = 0
    count: int = 0
    items: List[AiImageStorageItem] = []


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Effects Academy API", "status": "ok"}


@api_router.post("/auth/verify-password")
async def verify_password(payload: PasswordCheck):
    return {"valid": bool(USE_MOCK_DB and payload.password in LOCAL_PREVIEW_UPLOAD_PASSWORDS)}


@api_router.get("/auth/config")
async def auth_config():
    return {
        "google_client_id": GOOGLE_CLIENT_ID,
        "google_login_uri": GOOGLE_LOGIN_URI,
        "stripe_configured": bool(STRIPE_SECRET_KEY),
        "dev_login_enabled": USE_MOCK_DB,
        "object_storage_configured": USE_OBJECT_STORAGE,
        "ai_image_configured": bool(FAL_KEY),
        "fal_image_configured": bool(FAL_KEY),
        "fal_image_free_model": FAL_IMAGE_FREE_MODEL,
        "fal_image_premium_model": FAL_IMAGE_PREMIUM_MODEL,
        "fal_image_output_format": FAL_IMAGE_OUTPUT_FORMAT,
        "fal_image_premium_resolution": FAL_IMAGE_PREMIUM_RESOLUTION,
        "fal_image_max_dimension": FAL_IMAGE_MAX_DIMENSION,
    }


async def authenticate_google_credential(credential: str):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Login is not configured")
    try:
        info = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")
    if not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email is not verified")
    user_id = f"google:{info['sub']}"
    existing = await db.users.find_one({"id": user_id}, {"_id": 0})
    updates = {
        "email": info.get("email", ""),
        "name": info.get("name", ""),
        "picture": info.get("picture", ""),
        "updated_at": now_iso(),
        "role": role_for_email(info.get("email", ""), (existing or {}).get("role", "Viewer")),
    }
    if existing:
        await db.users.update_one({"id": user_id}, {"$set": updates})
    else:
        await db.users.insert_one({
            "id": user_id,
            **updates,
            "role": updates["role"],
            "premium_status": "inactive",
            "created_at": now_iso(),
        })
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    user = await sync_user_from_stripe(user)
    return {"token": create_session_token(user_id), "user": public_user(user)}


@api_router.post("/auth/google")
async def google_login(payload: GoogleCredential):
    return await authenticate_google_credential(payload.credential)


@api_router.post("/auth/google/callback")
async def google_login_callback(
    request: Request,
    credential: str = Form(...),
    g_csrf_token: str = Form(...),
):
    cookie_token = request.cookies.get("g_csrf_token")
    if not cookie_token or cookie_token != g_csrf_token:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google-csrf", status_code=303)
    try:
        result = await authenticate_google_credential(credential)
    except HTTPException:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google-signin", status_code=303)
    return RedirectResponse(
        f"{FRONTEND_URL}/auth/google/callback#token={result['token']}",
        status_code=303,
    )


@api_router.post("/auth/dev-login")
async def dev_login(payload: DevLoginRequest):
    if not USE_MOCK_DB:
        raise HTTPException(status_code=404, detail="Not found")
    user_id = "local:viewer"
    record = {
        "id": user_id,
        "email": "viewer@effectsacademy.local",
        "name": "Local Viewer",
        "picture": "",
        "role": "Viewer",
        "premium_status": "active" if payload.premium else "inactive",
        "updated_at": now_iso(),
    }
    await db.users.update_one(
        {"id": user_id},
        {"$set": record, "$setOnInsert": {"created_at": now_iso()}},
        upsert=True,
    )
    return {"token": create_session_token(user_id), "user": public_user(record)}


@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await request_user(request, required=True)
    return public_user(user)


@api_router.patch("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, payload: RoleUpdate, request: Request):
    await require_admin(request)
    if payload.role not in {"Viewer", "Uploader", "Admin"}:
        raise HTTPException(status_code=400, detail="Role must be Viewer, Uploader, or Admin")
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": payload.role, "updated_at": now_iso()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True, "role": payload.role}


@api_router.post("/billing/create-checkout-session")
async def create_checkout_session(request: Request):
    enforce_rate_limit(request, "checkout", limit=10, window_seconds=300)
    user = await request_user(request, required=True)
    if has_premium_access(user):
        return {"url": f"{FRONTEND_URL}/premium?already_subscribed=1"}
    if not STRIPE_SECRET_KEY:
        if USE_MOCK_DB:
            return {"url": f"{FRONTEND_URL}/premium?checkout=configuration-required", "demo": True}
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    line_item = {"price": STRIPE_PRICE_ID, "quantity": 1} if STRIPE_PRICE_ID else {
        "price_data": {
            "currency": "usd",
            "unit_amount": 599,
            "recurring": {"interval": "month"},
            "product_data": {"name": "Effects Academy Premium"},
        },
        "quantity": 1,
    }
    checkout_params = {
        "mode": "subscription",
        "client_reference_id": user["id"],
        "line_items": [line_item],
        "metadata": {"user_id": user["id"]},
        "subscription_data": {"metadata": {"user_id": user["id"]}},
        "success_url": f"{FRONTEND_URL}/premium?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{FRONTEND_URL}/premium?checkout=cancelled",
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
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"stripe_customer_id": customer_id, "updated_at": now_iso()}},
        )
    checkout_params["customer"] = customer_id
    session = stripe.checkout.Session.create(**checkout_params)
    return {"url": session.url}


@api_router.post("/billing/create-portal-session")
async def create_portal_session(request: Request):
    user = await request_user(request, required=True)
    if not STRIPE_SECRET_KEY or not user.get("stripe_customer_id"):
        raise HTTPException(status_code=400, detail="No Stripe customer is linked to this account")
    session = stripe.billing_portal.Session.create(
        customer=user["stripe_customer_id"],
        return_url=f"{FRONTEND_URL}/premium",
    )
    return {"url": session.url}


@api_router.post("/billing/confirm-checkout")
async def confirm_checkout(payload: CheckoutConfirmation, request: Request):
    user = await request_user(request, required=True)
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    try:
        session = stripe.checkout.Session.retrieve(payload.session_id)
    except stripe.error.StripeError:
        raise HTTPException(status_code=400, detail="Unable to verify Stripe checkout")
    session_user_id = (session.get("metadata") or {}).get("user_id") or session.get("client_reference_id")
    if session_user_id != user["id"]:
        raise HTTPException(status_code=403, detail="Checkout does not belong to this account")
    if session.get("status") != "complete":
        return {"premium_status": user.get("premium_status", "inactive"), "complete": False}
    subscription_id = session.get("subscription")
    subscription_status = "active"
    if subscription_id:
        subscription = stripe.Subscription.retrieve(subscription_id)
        subscription_status = subscription.get("status", "inactive")
    premium_status = subscription_status if subscription_status in {"active", "trialing"} else "inactive"
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "premium_status": premium_status,
            "stripe_customer_id": session.get("customer", ""),
            "stripe_subscription_id": subscription_id or "",
            "updated_at": now_iso(),
        }},
    )
    return {"premium_status": premium_status, "complete": True}


@api_router.post("/billing/webhook")
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook is not configured")
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook")

    obj = event["data"]["object"]
    event_type = event["type"]
    user_id = (obj.get("metadata") or {}).get("user_id") or obj.get("client_reference_id")
    if user_id and event_type == "checkout.session.completed":
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "premium_status": "active",
                "stripe_customer_id": obj.get("customer", ""),
                "stripe_subscription_id": obj.get("subscription", ""),
                "updated_at": now_iso(),
            }},
        )
    elif user_id and event_type in {"customer.subscription.updated", "customer.subscription.deleted"}:
        status = obj.get("status", "inactive")
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "premium_status": status if status in {"active", "trialing"} else "inactive",
                "stripe_subscription_id": obj.get("id", ""),
                "updated_at": now_iso(),
            }},
        )
    return {"received": True}


# Uploads ---------------------------------------------------------------
@api_router.post("/uploads")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
):
    await require_uploader(request)
    original_name = Path(file.filename or "upload").name
    ext = Path(original_name).suffix.lower()
    allowed_extensions = {
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".jfif",
        ".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac",
        ".zip", ".rar", ".7z", ".aep", ".prfpset", ".mogrt", ".ffx", ".cube",
    }
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="This file type is not allowed")
    file_id = f"{uuid.uuid4().hex}{ext}"
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit")
    if USE_OBJECT_STORAGE:
        try:
            await asyncio.to_thread(
                s3.put_object,
                Bucket=S3_BUCKET,
                Key=file_id,
                Body=content,
                ContentType=file.content_type or "application/octet-stream",
            )
        except Exception:
            logging.exception("Object storage upload failed")
            raise HTTPException(status_code=502, detail="Upload storage is temporarily unavailable")
        size = len(content)
    else:
        dest = UPLOAD_DIR / file_id
        dest.write_bytes(content)
        size = dest.stat().st_size
    return {
        "url": f"/api/uploads/{file_id}",
        "filename": original_name,
        "original_filename": original_name,
        "size": size,
    }


@api_router.get("/uploads/{filename}")
async def serve_upload(
    request: Request,
    filename: str,
    download: int = 0,
    name: Optional[str] = None,
):
    if Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    asset = await db.assets.find_one(
        {"file_url": f"/api/uploads/{filename}"},
        {"_id": 0},
    )
    if asset:
        await require_asset_access(request, asset)

    if USE_OBJECT_STORAGE:
        if S3_PUBLIC_BASE_URL and (not asset or asset.get("category") != "Premium"):
            return RedirectResponse(f"{S3_PUBLIC_BASE_URL}/{filename}", status_code=307)
        try:
            url = await asyncio.to_thread(
                s3.generate_presigned_url,
                "get_object",
                Params={
                    "Bucket": S3_BUCKET,
                    "Key": filename,
                    **({"ResponseContentDisposition": f'attachment; filename="{(name or filename).replace(chr(34), "")}"'} if download else {}),
                },
                ExpiresIn=900,
            )
        except Exception:
            logging.exception("Object storage download failed")
            raise HTTPException(status_code=404, detail="File not found")
        return RedirectResponse(url, status_code=307)

    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    file_size = file_path.stat().st_size
    media_type, _ = mimetypes.guess_type(str(file_path))
    media_type = media_type or "application/octet-stream"

    headers: dict = {"Accept-Ranges": "bytes"}
    if download:
        safe = (name or filename).replace('"', "")
        headers["Content-Disposition"] = f'attachment; filename="{safe}"'

    range_header = request.headers.get("range") or request.headers.get("Range")
    if range_header:
        m = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if m:
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else file_size - 1
            end = min(end, file_size - 1)
            if start > end:
                raise HTTPException(status_code=416, detail="Invalid range")
            length = end - start + 1

            def stream_range():
                with open(file_path, "rb") as f:
                    f.seek(start)
                    remaining = length
                    chunk = 64 * 1024
                    while remaining > 0:
                        data = f.read(min(chunk, remaining))
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


# Assets ----------------------------------------------------------------
@api_router.get("/assets", response_model=List[Asset])
async def list_assets(
    request: Request,
    category: Optional[str] = None,
    creator: Optional[str] = None,
    pack_id: Optional[str] = None,
    search: Optional[str] = None,
):
    q = {}
    if category:
        q["category"] = category
    if creator:
        q["creator_tag"] = creator
    if pack_id:
        q["pack_id"] = pack_id
    if search:
        q["title"] = {"$regex": search, "$options": "i"}
    docs = await db.assets.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    user = await request_user(request)
    can_manage = can_manage_assets(user)
    for doc in docs:
        doc["has_external_url"] = bool(doc.get("external_url"))
        if doc.get("category") == "Premium" and not can_manage:
            doc["external_url"] = ""
    return docs


@api_router.post("/assets", response_model=Asset)
async def create_asset(payload: AssetCreate, request: Request):
    await require_uploader(request)
    asset = Asset(**payload.model_dump())
    await db.assets.insert_one(asset.model_dump())
    return asset


@api_router.patch("/assets/{asset_id}", response_model=Asset)
async def update_asset(
    asset_id: str, payload: AssetUpdate, request: Request
):
    await require_uploader(request)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.assets.update_one({"id": asset_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Asset not found")
    doc = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    return doc


@api_router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, request: Request):
    await require_uploader(request)
    res = await db.assets.delete_one({"id": asset_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Asset not found")
    return {"ok": True}


@api_router.post("/assets/{asset_id}/download")
async def increment_download(asset_id: str, request: Request):
    asset = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(404, "Asset not found")
    await require_asset_access(request, asset)
    res = await db.assets.update_one({"id": asset_id}, {"$inc": {"download_count": 1}})
    if res.matched_count == 0:
        raise HTTPException(404, "Asset not found")
    doc = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    return {"download_count": doc["download_count"]}


@api_router.post("/assets/{asset_id}/premium-download-link", response_model=PremiumDownloadLink)
async def create_premium_download_link(asset_id: str, request: Request):
    user = await request_user(request, required=True)
    asset = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(404, "Asset not found")
    await require_asset_access(request, asset)
    if asset.get("category") != "Premium":
        raise HTTPException(400, "Temporary links are only required for Premium assets")
    if not asset.get("external_url"):
        raise HTTPException(404, "This Premium asset does not have an external link")

    access_mode = "moderator" if can_manage_assets(user) else "premium"
    now_ts = int(time.time())
    expires_at = now_ts + PREMIUM_DOWNLOAD_LINK_TTL_SECONDS
    token = secrets.token_urlsafe(32)
    await db.premium_download_links.delete_many({"expires_at": {"$lte": now_ts}})
    await db.premium_download_links.insert_one({
        "id": token,
        "token": token,
        "asset_id": asset["id"],
        "user_id": user["id"],
        "title": asset.get("title", "Premium download"),
        "external_url": asset["external_url"],
        "access_mode": access_mode,
        "user_role": user.get("role", "Viewer"),
        "created_at": now_ts,
        "expires_at": expires_at,
    })
    await db.assets.update_one({"id": asset_id}, {"$inc": {"download_count": 1}})
    return {
        "url": f"{FRONTEND_URL}/download/{token}",
        "token": token,
        "expires_at": expires_at,
        "expires_in_seconds": PREMIUM_DOWNLOAD_LINK_TTL_SECONDS,
    }


@api_router.get("/premium-downloads/{token}")
async def get_premium_download(token: str, request: Request):
    user = await request_user(request, required=True)
    link = await db.premium_download_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(404, "Temporary link not found")
    now_ts = int(time.time())
    if int(link.get("expires_at", 0)) <= now_ts:
        await db.premium_download_links.delete_one({"token": token})
        raise HTTPException(410, "Temporary link expired")
    if link.get("user_id") != user.get("id"):
        raise HTTPException(403, "This temporary link belongs to another signed-in account")
    if not has_premium_access(user):
        raise HTTPException(status_code=402, detail="Premium subscription required")

    return {
        "title": link.get("title", "Premium download"),
        "asset_id": link.get("asset_id", ""),
        "download_url": link.get("external_url", ""),
        "access_mode": link.get("access_mode", "premium"),
        "access_label": "Moderator access" if link.get("access_mode") == "moderator" else "Premium checked",
        "expires_at": link.get("expires_at"),
        "seconds_remaining": max(0, int(link.get("expires_at", 0)) - now_ts),
        "single_use": False,
        "encrypted": True,
    }


# Packs -----------------------------------------------------------------
@api_router.get("/packs", response_model=List[Pack])
async def list_packs(category: Optional[str] = None):
    q = {}
    if category:
        q["category"] = category
    docs = await db.packs.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.post("/packs", response_model=Pack)
async def create_pack(payload: PackCreate, request: Request):
    await require_uploader(request)
    pack = Pack(**payload.model_dump())
    await db.packs.insert_one(pack.model_dump())
    return pack


@api_router.delete("/packs/{pack_id}")
async def delete_pack(pack_id: str, request: Request):
    await require_uploader(request)
    await db.packs.delete_one({"id": pack_id})
    await db.assets.update_many({"pack_id": pack_id}, {"$set": {"pack_id": ""}})
    return {"ok": True}


# Custom categories -----------------------------------------------------
@api_router.get("/categories", response_model=List[CustomCategory])
async def list_categories(parent: Optional[str] = None):
    q = {}
    if parent:
        q["parent_category"] = parent
    docs = await db.custom_categories.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.post("/categories", response_model=CustomCategory)
async def create_category(
    payload: CustomCategoryCreate, request: Request
):
    await require_uploader(request)
    cat = CustomCategory(**payload.model_dump())
    await db.custom_categories.insert_one(cat.model_dump())
    return cat


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, request: Request):
    await require_uploader(request)
    await db.custom_categories.delete_one({"id": cat_id})
    return {"ok": True}


# DMCA + Suggestions ----------------------------------------------------
@api_router.post("/dmca", response_model=ContactSubmission)
async def submit_dmca(payload: ContactCreate, request: Request):
    enforce_rate_limit(request, "dmca", limit=3, window_seconds=300)
    if not dmca_email_configured():
        raise HTTPException(
            status_code=503,
            detail="DMCA email delivery is not configured yet. Please email EffectsAcademy2026@hotmail.com directly.",
        )
    sub = ContactSubmission(kind="dmca", **payload.model_dump())
    try:
        await asyncio.to_thread(_send_dmca_email, sub)
    except (OSError, smtplib.SMTPException):
        logging.exception("Unable to deliver DMCA notice %s", sub.id)
        raise HTTPException(
            status_code=502,
            detail="The notice could not be emailed. Please email EffectsAcademy2026@hotmail.com directly.",
        )
    await db.contact_submissions.insert_one(sub.model_dump())
    return sub


@api_router.post("/suggestions", response_model=ContactSubmission)
async def submit_suggestion(payload: SuggestionCreate, request: Request):
    enforce_rate_limit(request, "suggestions", limit=5, window_seconds=300)
    if not dmca_email_configured():
        raise HTTPException(status_code=503, detail="Suggestion email delivery is not configured yet.")
    sub = ContactSubmission(
        kind="suggestion",
        full_name="Anonymous",
        email="",
        **payload.model_dump(),
    )
    try:
        await asyncio.to_thread(_send_suggestion_email, sub)
    except (OSError, smtplib.SMTPException):
        logging.exception("Unable to deliver suggestion %s", sub.id)
        raise HTTPException(status_code=502, detail="The suggestion could not be emailed. Please try again.")
    await db.contact_submissions.insert_one(sub.model_dump())
    return sub


# AI Image Editor -------------------------------------------------------
@api_router.get("/ai-image/usage")
async def ai_image_usage(request: Request):
    user = await request_user(request, required=True)
    return await ai_usage_for_user(user)


@api_router.get("/ai-image/storage", response_model=AiImageStorageResponse)
async def ai_image_storage(request: Request):
    user = await request_user(request, required=True)
    if not has_premium_access(user):
        return {"available": False, "total_bytes": 0, "count": 0, "items": []}

    summary = await db.ai_image_generations.aggregate([
        {"$match": {"user_id": user["id"]}},
        {"$group": {"_id": "$user_id", "total_bytes": {"$sum": "$size_bytes"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    stats = summary[0] if summary else {"total_bytes": 0, "count": 0}
    items = await db.ai_image_generations.find(
        {"user_id": user["id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(30)
    return {
        "available": True,
        "total_bytes": int(stats.get("total_bytes", 0)),
        "count": int(stats.get("count", 0)),
        "items": items,
    }


@api_router.post("/ai-image/edit", response_model=AiImageEditResponse)
async def edit_ai_image(
    request: Request,
    image: UploadFile = File(...),
    replacement_text: str = Form(...),
    style_notes: str = Form(""),
):
    enforce_rate_limit(request, "ai-image", limit=20, window_seconds=300)
    user = await request_user(request, required=True)
    if not FAL_KEY:
        raise HTTPException(status_code=503, detail="Fal Nano Banana image generation is not configured yet")

    usage = await ai_usage_for_user(user)
    if not usage.get("unlimited") and usage["remaining"] <= 0:
        raise HTTPException(
            status_code=429,
            detail=f"Daily AI image limit reached. You can generate {usage['limit']} image edits per day.",
        )

    content_type = (image.content_type or "").lower()
    allowed_types = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Upload a PNG, JPG, JPEG, or WEBP image")

    image_bytes = await image.read(AI_IMAGE_MAX_BYTES + 1)
    if len(image_bytes) > AI_IMAGE_MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"Image must be under {AI_IMAGE_MAX_BYTES // (1024 * 1024)}MB")
    _, upload_bytes, upload_content_type = prepare_fal_image_upload(
        image_bytes,
        content_type,
        image.filename or "image.png",
    )

    replacement_text = replacement_text.strip()
    style_notes = style_notes.strip()
    if not replacement_text:
        raise HTTPException(status_code=400, detail="Tell the AI what the text should say")
    if len(replacement_text) > 280:
        raise HTTPException(status_code=400, detail="Keep replacement text under 280 characters")
    if len(style_notes) > 700:
        raise HTTPException(status_code=400, detail="Keep style notes under 700 characters")

    prompt = (
        "Edit the uploaded image itself. Treat the uploaded image as the exact source design, not as inspiration for a new design. "
        "Make a minimal text-only edit unless the style notes explicitly require a tiny supporting color adjustment. "
        "Do not redesign the image. Do not change the canvas, crop, text size, text position, camera angle, layout, or composition. "
        "Do not add new objects, people, vehicles, scenery, landmarks, extra logos, or decorative elements. "
        "Keep the original background, lighting, shadows, colors, reflections, texture, glow, bevels, metallic finish, and graphic style as closely as possible. "
        "Replace the existing visible text according to the user's request, matching the original font style, letter thickness, perspective, material, bevel, texture, glow, and placement as closely as possible. "
        "If the user request says something like 'change X to Y' or 'replace X with Y', only put Y in the image. Do not write the whole instruction sentence. "
        "Remove the original text instead of keeping it. "
        f"User text edit request: {replacement_text}"
    )
    if style_notes:
        prompt += f"\nAdditional style instructions: {style_notes}"

    image_settings = ai_image_settings_for_user(user)

    def call_fal_image_edit():
        encoded_image = base64.b64encode(upload_bytes).decode("utf-8")
        image_data_url = f"data:{upload_content_type};base64,{encoded_image}"
        headers = {
            "Authorization": f"Key {FAL_KEY}",
            "Content-Type": "application/json",
        }
        fal_payload = {
            "prompt": prompt,
            "image_urls": [image_data_url],
            "num_images": 1,
            "aspect_ratio": FAL_IMAGE_ASPECT_RATIO,
            "output_format": FAL_IMAGE_OUTPUT_FORMAT,
            "safety_tolerance": str(FAL_IMAGE_SAFETY_TOLERANCE),
            "sync_mode": False,
            "limit_generations": True,
        }
        if image_settings.get("resolution"):
            fal_payload["resolution"] = image_settings["resolution"]
            fal_payload["system_prompt"] = (
                "You are an image text editing model. Preserve the uploaded reference image as closely as possible. "
                "Only change the requested visible text and keep the original design, layout, materials, lighting, and background."
            )

        response = requests.post(
            f"{FAL_QUEUE_BASE_URL}/{image_settings['model']}",
            headers=headers,
            json=fal_payload,
            timeout=60,
        )
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail=fal_error_message(payload))
        if payload.get("images"):
            return extract_fal_image_data(payload)

        status_url = payload.get("status_url")
        response_url = payload.get("response_url")
        if not status_url or not response_url:
            raise HTTPException(status_code=502, detail="Fal did not return a queue status URL")

        for _ in range(FAL_STATUS_MAX_POLLS):
            status_response = requests.get(status_url, headers=headers, timeout=30)
            try:
                status_payload = status_response.json()
            except ValueError:
                status_payload = {}
            if status_response.status_code >= 400:
                raise HTTPException(status_code=502, detail=fal_error_message(status_payload, "Fal status check failed"))
            status = status_payload.get("status", "")
            if status == "COMPLETED":
                break
            if status in {"FAILED", "ERROR"} or status_payload.get("error"):
                raise HTTPException(status_code=502, detail=fal_error_message(status_payload))
            time.sleep(FAL_STATUS_POLL_SECONDS)
        else:
            raise HTTPException(status_code=504, detail="Fal image edit is taking too long. Please try again.")

        result_response = requests.get(response_url, headers=headers, timeout=90)
        try:
            result_payload = result_response.json()
        except ValueError:
            result_payload = {}
        if result_response.status_code >= 400:
            raise HTTPException(status_code=502, detail=fal_error_message(result_payload, "Fal result fetch failed"))
        return extract_fal_image_data(result_payload)

    image_base64, output_mime_type = await asyncio.to_thread(call_fal_image_edit)

    record_id = f"{user['id']}:{usage['date']}"
    await db.ai_image_usage.update_one(
        {"id": record_id},
        {
            "$setOnInsert": {
                "id": record_id,
                "user_id": user["id"],
                "date": usage["date"],
                "created_at": now_iso(),
            },
            "$inc": {"used": 1},
            "$set": {
                "role": user.get("role", "Viewer"),
                "premium_status": user.get("premium_status", "inactive"),
                "updated_at": now_iso(),
            },
        },
        upsert=True,
    )
    updated_usage = await ai_usage_for_user(user)
    storage_saved = False
    storage_item_id = None
    if has_premium_access(user):
        storage_item_id = str(uuid.uuid4())
        await db.ai_image_generations.insert_one({
            "id": storage_item_id,
            "user_id": user["id"],
            "user_email": user.get("email", ""),
            "image_base64": image_base64,
            "mime_type": output_mime_type,
            "replacement_text": replacement_text,
            "style_notes": style_notes,
            "image_provider": image_settings["provider"],
            "image_model": image_settings["model"],
            "image_tier": image_settings["tier"],
            "size_bytes": base64_size_bytes(image_base64),
            "created_at": now_iso(),
        })
        storage_saved = True

    return {
        "image_base64": image_base64,
        "mime_type": output_mime_type,
        "used": updated_usage["used"],
        "limit": updated_usage["limit"],
        "remaining": updated_usage["remaining"],
        "unlimited": updated_usage["unlimited"],
        "image_provider": image_settings["provider"],
        "image_model": image_settings["model"],
        "image_tier": image_settings["tier"],
        "storage_saved": storage_saved,
        "storage_item_id": storage_item_id,
    }


@api_router.get("/submissions", response_model=List[ContactSubmission])
async def list_submissions(
    request: Request, kind: Optional[str] = None
):
    await require_uploader(request)
    q = {}
    if kind:
        q["kind"] = kind
    docs = await db.contact_submissions.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


# Stats -----------------------------------------------------------------
@api_router.get("/health")
async def health():
    await db.command("ping")
    return {
        "ok": True,
        "database": "connected",
        "object_storage": USE_OBJECT_STORAGE,
        "stripe": bool(STRIPE_SECRET_KEY),
        "smtp": dmca_email_configured(),
        "ai_image": bool(FAL_KEY),
        "fal_image": bool(FAL_KEY),
        "fal_image_free_model": FAL_IMAGE_FREE_MODEL,
        "fal_image_premium_model": FAL_IMAGE_PREMIUM_MODEL,
        "fal_image_output_format": FAL_IMAGE_OUTPUT_FORMAT,
        "fal_image_premium_resolution": FAL_IMAGE_PREMIUM_RESOLUTION,
        "fal_image_max_dimension": FAL_IMAGE_MAX_DIMENSION,
    }


@api_router.get("/stats")
async def stats():
    total = await db.assets.count_documents({})
    return {"total_assets": total}


@api_router.get("/distinct/creators")
async def distinct_creators():
    values = await db.assets.distinct("creator_tag", {"category": "Audios"})
    return [v for v in values if v]


@api_router.get("/distinct/shows")
async def distinct_shows():
    values = await db.assets.distinct("show_group", {"category": "Torrents"})
    return [v for v in values if v]


# Category Overrides (uploader-managed thumbnails + soft delete for shows/creators)
@api_router.get("/category-overrides", response_model=List[CategoryOverride])
async def list_category_overrides(kind: Optional[str] = None):
    q = {}
    if kind:
        q["kind"] = kind
    docs = await db.category_overrides.find(q, {"_id": 0}).to_list(500)
    return docs


@api_router.put("/category-overrides/{kind}/{name}", response_model=CategoryOverride)
async def upsert_category_override(
    kind: str,
    name: str,
    payload: CategoryOverrideUpsert,
    request: Request,
):
    await require_uploader(request)
    if kind not in ("show", "creator"):
        raise HTTPException(400, "kind must be 'show' or 'creator'")
    existing = await db.category_overrides.find_one({"kind": kind, "name": name}, {"_id": 0})
    if existing:
        updates = {"updated_at": now_iso()}
        for k in ("image_url", "color_from", "color_to", "accent", "text_color", "blur_px", "deleted"):
            v = getattr(payload, k)
            if v is not None:
                updates[k] = v
        await db.category_overrides.update_one(
            {"kind": kind, "name": name}, {"$set": updates}
        )
        doc = await db.category_overrides.find_one(
            {"kind": kind, "name": name}, {"_id": 0}
        )
        return doc
    record = CategoryOverride(
        kind=kind,
        name=name,
        image_url=payload.image_url or "",
        color_from=payload.color_from or "",
        color_to=payload.color_to or "",
        accent=payload.accent or "",
        text_color=payload.text_color or "",
        blur_px=payload.blur_px,
        deleted=bool(payload.deleted) if payload.deleted is not None else False,
    )
    await db.category_overrides.insert_one(record.model_dump())
    return record


@api_router.delete("/category-overrides/{kind}/{name}")
async def delete_category_override(
    kind: str, name: str, request: Request
):
    await require_uploader(request)
    await db.category_overrides.delete_one({"kind": kind, "name": name})
    return {"ok": True}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    return response


app.include_router(api_router)


@app.on_event("startup")
async def seed_local_catalog():
    if not USE_MOCK_DB or await db.assets.count_documents({}) > 0:
        return
    seed_path = ROOT_DIR / "local_seed.json"
    if not seed_path.exists():
        return
    seed = json.loads(seed_path.read_text(encoding="utf-8"))
    assets = seed.get("assets", [])
    if assets:
        await db.assets.insert_many(assets)
    if await db.assets.count_documents({"category": "Premium"}) == 0:
        await db.assets.insert_one(Asset(
            id="local-premium-demo",
            title="Premium Demo Pack",
            description="Local preview asset for testing Viewer locks and subscription access.",
            category="Premium",
            thumbnail_url="/api/uploads/00b77db849bf4baf8f62c9c3889c09b0.png",
            file_url="/api/uploads/premium-demo-pack.rar",
            original_filename="Effects-Academy-Premium-Demo.rar",
        ).model_dump())

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[origin.strip() for origin in os.environ.get("CORS_ORIGINS", FRONTEND_URL).split(",") if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
