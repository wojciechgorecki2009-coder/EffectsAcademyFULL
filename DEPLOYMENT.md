# Effects Academy deployment checklist

This project is ready to run as:

- a React frontend
- a FastAPI backend
- MongoDB Atlas for the database
- S3-compatible object storage, such as Cloudflare R2, for uploaded assets
- Stripe Checkout for Premium
- Google OAuth for login
- Fal.ai Nano Banana image generation for the AI text image editor
- Brevo SMTP for DMCA and suggestions emails

## Important security cleanup before launch

Rotate any API keys that were pasted during local setup before going live. That includes Stripe live/restricted keys and Brevo SMTP keys. Use fresh production keys in the hosting dashboard only; do not commit them to the repo.

## Backend environment variables

Use `backend/.env.example` as the production checklist. In production:

- `USE_MOCK_DB` must be `0`.
- `JWT_SECRET` must be a long random value.
- `MONGO_URL` and `DB_NAME` must point to a real MongoDB Atlas database.
- `FRONTEND_URL` must be your real website URL.
- `CORS_ORIGINS` must include your real website URL.
- `ADMIN_EMAILS` should include the owner Google email.
- `UPLOADER_EMAILS` should include moderator Google emails.
- `UPLOAD_PASSWORD` should not be used in production.

## Frontend environment variables

Use `frontend/.env.example`.

`REACT_APP_BACKEND_URL` must be your deployed backend URL, for example:

```text
https://effects-academy-api.onrender.com
```

## Google OAuth setup

In Google Cloud Console, open your OAuth client and configure:

- Authorized JavaScript origins:
  - `https://www.your-domain.com`
  - your frontend hosting URL if you use one before connecting a domain
- Authorized redirect URIs:
  - `https://api.your-domain.com/api/auth/google/callback`
  - or your backend hosting URL plus `/api/auth/google/callback`

Set `GOOGLE_LOGIN_URI` to the same backend callback URL.

## Stripe setup

Create a live Stripe product called `Effects Academy Premium`.

Create a recurring monthly price for `$4.99 USD`.

Set these backend variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

Create a Stripe webhook endpoint:

```text
https://api.your-domain.com/api/billing/webhook
```

Subscribe it to:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Enable the Stripe Customer Portal so subscribed users can manage or cancel their subscription.

## Brevo setup

Verify the sender email in Brevo. For best deliverability, use a custom domain and complete DKIM/DMARC authentication.

Set:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `DMCA_TO_EMAIL`

DMCA and Suggestions both send to `DMCA_TO_EMAIL`.

## Fal.ai Nano Banana AI image setup

Create a Fal.ai API key and save it on the Render backend service as:

- `FAL_KEY`

The default setup is:

- Free users: `fal-ai/nano-banana/edit`
- Premium users and moderators: `fal-ai/nano-banana/edit`

Optional backend variables:

- `FAL_IMAGE_FREE_MODEL`
- `FAL_IMAGE_PREMIUM_MODEL`
- `FAL_IMAGE_OUTPUT_FORMAT`
- `FAL_IMAGE_ASPECT_RATIO`
- `FAL_IMAGE_SAFETY_TOLERANCE`
- `FAL_IMAGE_MAX_DIMENSION`
- `FAL_IMAGE_JPEG_QUALITY`
- `FAL_STATUS_POLL_SECONDS`
- `FAL_STATUS_MAX_POLLS`

The site uses Fal's queue-backed `fal-ai/nano-banana/edit` endpoint so uploaded images can be edited server-side without exposing your API key in the browser. If Fal later offers a better premium image-edit model, set `FAL_IMAGE_PREMIUM_MODEL` to that model ID in Render.

## Object storage setup

Use Cloudflare R2, AWS S3, Backblaze B2, or another S3-compatible provider.

Set:

- `S3_BUCKET`
- `S3_ENDPOINT_URL`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`

Premium files are served through protected signed URLs. Public assets can use `S3_PUBLIC_BASE_URL`.

## Recommended hosting

Simple path:

- Backend: Render or Railway
- Frontend: Vercel, Netlify, Cloudflare Pages, or Render static site
- Database: MongoDB Atlas
- Assets: Cloudflare R2

The included `render.yaml` can deploy both backend and frontend on Render, but Vercel/Cloudflare Pages are also good for the frontend.

## Final launch test

Before announcing the site:

1. Sign in with Google as the owner.
2. Confirm owner email is listed in `ADMIN_EMAILS`.
3. Sign in with a moderator email listed in `UPLOADER_EMAILS`.
4. Upload a test asset, thumbnail, and category background.
5. Submit a DMCA form and confirm it arrives in the inbox.
6. Submit a suggestion and confirm it arrives in the inbox.
7. Buy Premium with Stripe live checkout using a real low-risk test purchase, then refund yourself in Stripe.
8. Confirm the same Google account unlocks Premium after logging out and back in.
9. Confirm a normal Viewer can see Premium assets but cannot download them.
10. Confirm the Stripe customer portal opens from the Premium page.
