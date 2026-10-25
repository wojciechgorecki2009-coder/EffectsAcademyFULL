# BitStudio Hosted Multichat

This is an independent Render service for the OBS Custom Browser Dock. It does not run inside, proxy through, or modify the Effects Academy frontend or API. The public dock URL is `https://chat.effectsacademy.com/` and needs no BitStudio process on the user's computer.

## Render service

Create a **separate Node web service** from this repository with Root Directory `bitstudio-chat`, Build Command `npm ci`, Start Command `npm start`, and Health Check Path `/health`. Attach the custom domain `chat.effectsacademy.com` to that new service. Do not change the existing Effects Academy services or DNS records for the apex or `www` domains.

Run only one service instance. Live chat connections and the most recent messages are held in that instance's memory; horizontal scaling would need shared fan-out and routing before it is enabled.

Set these environment variables in the **new service only**:

| Variable | Value |
| --- | --- |
| `BASE_URL` | `https://chat.effectsacademy.com` |
| `MONGO_URL` | MongoDB connection for a separate BitStudio chat database |
| `DB_NAME` | `bitstudio_chat` |
| `TOKEN_ENCRYPTION_KEY` | New random 32-byte key as 64 hex characters; keep stable across deploys |
| `TWITCH_CLIENT_ID` | Public BitStudio Twitch client ID |
| `GOOGLE_CLIENT_ID` | New Google OAuth **Web application** client ID |
| `GOOGLE_CLIENT_SECRET` | Secret for that Web client, entered only in Render |

The database stores Twitch and YouTube refresh tokens encrypted with AES-256-GCM. Keep the encryption key out of the repository and back it up securely. Rotating it without migrating stored tokens will require users to reconnect.

## OAuth setup

In the Google Cloud project, register `https://chat.effectsacademy.com/auth/youtube/callback` as an **authorized redirect URI** on the new Web application OAuth client. The requested scope is `https://www.googleapis.com/auth/youtube.force-ssl`. Google may require OAuth consent-screen verification before users outside its test list can connect. Do not use BitStudio's Desktop OAuth client for this website.

Twitch uses the existing Public client through device sign-in. There is no Twitch redirect URI or Twitch client secret for this service. The person signing in opens Twitch's activation link in a regular browser while the OBS dock waits for completion. Twitch Public-client refresh tokens can expire after 30 days of inactivity; the user can reconnect from the dock.

Google sign-in also happens in a regular browser: the OBS dock produces a short-lived connection link, which can be copied and opened externally. The callback stores the YouTube authorization against the Twitch account signed in to the dock. No Google sign-in occurs inside OBS's embedded browser.

## Usage

In OBS, open **Docks > Custom Browser Docks**, name it `BitStudio Multichat`, and enter `https://chat.effectsacademy.com/`. Connect Twitch and YouTube from the dock's settings button. Twitch and 7TV emotes are rendered in Twitch messages. YouTube displays its message text, including Unicode emoji. Clicking an author opens timeout and ban actions.

The service only follows an active YouTube live broadcast; it does not start, change, or end broadcasts. It polls YouTube at the interval returned by the Live Chat API. Chat history is held in memory while a dock is open and is not archived in MongoDB.

## Local verification

Run `npm ci` then `npm test`. Live Twitch/YouTube authorization and chat require the deployed HTTPS domain, OAuth configuration, and a connected account.
