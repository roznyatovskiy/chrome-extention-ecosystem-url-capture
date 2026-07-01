# Ecosystem URL Capture

A Chrome extension for ecosystem players to **aggregate startups into shared,
themed collections**. Click the extension on any tab, pick one or more
collections, and the cleaned URL is filed into a shared database — deduplicated
per collection, attributed to you, with timestamp + metadata.

Roles control who can write where: contributors only see and fill the
collections they've been granted; admins see everything.

---

## Install — one click

**→ [Add to Chrome — Ecosystem URL Capture](https://chromewebstore.google.com/detail/ecosystem-url-capture/ijhopdbbcjldpcdjfpiiofhhcolegiii)**

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ijhopdbbcjldpcdjfpiiofhhcolegiii?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/ecosystem-url-capture/ijhopdbbcjldpcdjfpiiofhhcolegiii)
[![Users](https://img.shields.io/chrome-web-store/users/ijhopdbbcjldpcdjfpiiofhhcolegiii?label=users)](https://chromewebstore.google.com/detail/ecosystem-url-capture/ijhopdbbcjldpcdjfpiiofhhcolegiii)
[![Rating](https://img.shields.io/chrome-web-store/rating/ijhopdbbcjldpcdjfpiiofhhcolegiii?label=rating)](https://chromewebstore.google.com/detail/ecosystem-url-capture/ijhopdbbcjldpcdjfpiiofhhcolegiii)

Open the store page, click **Add to Chrome**, then pin the icon and log in with
the email + password you were given by whoever runs the project. Chrome installs
it in one click and keeps it updated automatically.

## Using it

1. Click the extension on the tab you want to capture.
2. The current URL shows at top. Below it, your **recent** collections appear;
   use the **search** box to find others you're allowed to write to.
3. Click collections to select them — selected ones pin to the top as chips.
4. Hit **Capture** → the URL is filed into every selected collection at once.

## What's in this repo

This public repo holds the **extension client** ([`extension/`](extension/)) and
the landing/privacy pages served via GitHub Pages. The backend (database schema,
setup, admin tooling, and ops docs) lives in a separate private repo.

- [`extension/`](extension/) — the MV3 Chrome extension (no build step).
- [`extension/config.js`](extension/config.js) — public Supabase URL + anon key.

---

ECOSYSTEM URL CAPTURE · [Privacy Policy](privacy.html)
