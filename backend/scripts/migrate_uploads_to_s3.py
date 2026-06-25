"""
Upload existing local backend/uploads files to S3-compatible storage.

Run this only after setting the S3_* environment variables from backend/.env.example.
It does not delete local files.
"""

import os
from pathlib import Path

import boto3
from botocore.client import Config as BotoConfig
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

bucket = os.environ["S3_BUCKET"]
endpoint = os.environ.get("S3_ENDPOINT_URL") or None
region = os.environ.get("S3_REGION", "auto")
access_key = os.environ["S3_ACCESS_KEY_ID"]
secret_key = os.environ["S3_SECRET_ACCESS_KEY"]
uploads = ROOT / "uploads"

s3 = boto3.client(
    "s3",
    endpoint_url=endpoint,
    region_name=region,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    config=BotoConfig(signature_version="s3v4"),
)

count = 0
for path in uploads.iterdir():
    if not path.is_file():
        continue
    key = path.name
    s3.upload_file(str(path), bucket, key)
    count += 1
    print(f"uploaded {key}")

print(f"done: uploaded {count} files")
