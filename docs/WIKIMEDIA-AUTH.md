# Wikimedia Commons authentication (better rate limits)

Authenticated requests to Wikimedia Commons get **higher rate limits** than anonymous or User-Agent-only requests. This project supports optional **bot password** login.

## 1. Create a bot password on Commons

1. **Log in** to [Wikimedia Commons](https://commons.wikimedia.org/) with your account.
2. Open **Special:BotPasswords**:  
   [https://commons.wikimedia.org/wiki/Special:BotPasswords](https://commons.wikimedia.org/wiki/Special:BotPasswords)
3. Create a new bot password:
   - **App name**: e.g. `owlby` (used as the second part of the username).
   - **Grants**: you can leave minimal (e.g. no “High volume” unless you need it); read-only use for image search/file details does not require special grants.
4. **Save**. You will see:
   - **Username**: `YourCommonsUsername@owlby` (or whatever app name you chose).
   - **Password**: a long generated password (save it once; it cannot be shown again).

## 2. Set environment variables

Set these in your deployment (e.g. Vercel env vars or local `.env`); the code reads them at runtime and uses them only when both are present.

| Variable | Example | Description |
|----------|---------|-------------|
| `WIKIMEDIA_BOT_USER` | `MyCommonsUser@owlby` | The full bot-username from the bot password page. |
| `WIKIMEDIA_BOT_PASSWORD` | *(the generated password)* | The bot password (keep secret). |

- If **both** are set, the Commons client will log in via the Action API and send the session cookie with REST (search and file) requests.
- If either is missing, requests run **unauthenticated** (User-Agent only); behavior is unchanged except for rate limits.

## 3. How it works in code

- **Login**: `lib/wikimedia-commons.ts` uses the Action API (`api.php`) with `action=login` and your bot username/password to obtain a session. The session cookie is cached in memory for about 50 minutes.
- **Requests**: All Commons REST calls (`search/page` and `file/...`) send the `User-Agent` and, when auth is configured, the `Cookie` header so you get authenticated rate limits.

No code changes are required beyond setting the env vars; the client uses auth automatically when available.
