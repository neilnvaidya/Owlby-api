# Owlby API

Vercel serverless backend for Owlby — the AI generation and auth gateway between the mobile app and
Google Gemini / Supabase. Node.js + TypeScript (ESM).

> **How this fits the whole system:** see [`../Docs/Technical/SYSTEM_OVERVIEW.md`](../Docs/Technical/SYSTEM_OVERVIEW.md)
> (only resolves in a combined monorepo checkout).

---

## What it is

- **Serverless functions.** Each file under [`api/`](api/) is a standalone handler. Public paths are
  mapped to handlers by the `rewrites` in [`vercel.json`](vercel.json) (kept within the Vercel
  free-tier function limit — see [`docs/API-ROUTE-CONSOLIDATION.md`](docs/API-ROUTE-CONSOLIDATION.md)).
- **AI provider: Google Gemini only** (`@google/genai`). No other providers. Model selection and the
  per-route fallback chain are centralised in [`lib/config.ts`](lib/config.ts):
  - Primary: `gemini-3.1-flash-lite-preview`
  - Fallback 1: `gemini-3-flash-preview`
  - Fallback 2: `gemini-2.5-flash`
- **Auth via Supabase.** The service-role key verifies app JWTs server-side
  ([`lib/auth-supabase.ts`](lib/auth-supabase.ts); token cache held ~5 min in process memory).

## Request lifecycle

Every handler runs through one pipeline in [`lib/api-handler.ts`](lib/api-handler.ts):

1. **`handleCORS`** — sets CORS headers, rejects non-POST.
2. **`verifySupabaseToken`** — validates the `Bearer` JWT (Supabase service-role).
3. **`canGenerate`** — subscription gate ([`lib/subscription-gate.ts`](lib/subscription-gate.ts)).
   Disabled by default; set `SUBSCRIPTION_GATE_ENABLED=true` to enforce free-tier limits.
4. **`processAIRequest`** — calls Gemini with retry + fallback.

> **Key convention — errors return HTTP 200.** All errors respond `200` with
> `{ success: false, error, userMessage }`, never a non-2xx status. Native apps pop a system dialog
> on non-2xx responses, so we avoid that on purpose. Keep this everywhere.

## Endpoints

Public path → handler (via `vercel.json`):

| Path | Handler | Purpose |
|---|---|---|
| `/lesson/start` | `api/lesson/start.ts` | Lesson v3 step 1 — hook + opening question |
| `/lesson/objectives` | `api/lesson/objectives.ts` | Step 2 — objectives + init `LessonObjectivesState` |
| `/lesson/chunk` | `api/lesson/chunk.ts` | Step 3 — teaching content + questions |
| `/lesson/evaluate` | `api/lesson/evaluate.ts` | Step 4 — evaluate short-answer / higher-order |
| `/lesson/consolidation` | `api/lesson/consolidation.ts` | Step 5 — final MCQ + closing |
| `/chat/response` | `api/chat/generate-response.ts` | Conversational responses |
| `/story/...` | `api/story/generate-story.ts` | Story generation (illustrated, Wikimedia images) |
| `/media/image` | `api/media/image.ts` | Wikimedia Commons image lookup |
| `/achievements/sync` | `api/achievements/sync.ts` | Achievement sync |
| `/feedback/submit` | `api/feedback/submit.ts` | User feedback |
| `/profile`, `/health`, `/subscription-status`, `/delete-account`, `/webhooks/revenuecat` | `api/profile.ts` | Profile + several scopes (consolidated handler) |
| `/verify-email`, `/send-verification`, `/resend-verification` | `api/email.ts` | Email verification (web hand-off) |

See `vercel.json` for the complete, authoritative list of rewrites.

## Lesson System v3

The lesson flow is shared with the app: **`LessonObjectivesState` is the single source of truth,
passed back and forth between client and server.** Validators that enforce the invariants live in
[`lib/lesson-v3-types.ts`](lib/lesson-v3-types.ts) and
[`lib/lesson-v3-chunk-validate.ts`](lib/lesson-v3-chunk-validate.ts); shared route logic in
[`lib/lesson-v3-route-common.ts`](lib/lesson-v3-route-common.ts) and AI calls in
[`lib/lesson-v3-ai.ts`](lib/lesson-v3-ai.ts).

**Age bands** are the single source of truth in [`lib/lesson-age.ts`](lib/lesson-age.ts) (mirrored
app-side in `Owlby-app/utils/lesson-v3-age.ts`): 5–7, 8–11, 12–15, 16–18 control objective count,
question type, and content length. Full spec: [`../Docs/lesson_system_spec_v3.md`](../Docs/lesson_system_spec_v3.md).

## Subscription tiers

All tier logic is in [`lib/subscription-gate.ts`](lib/subscription-gate.ts):
- **`premium`** — active subscription
- **`early_adopter`** — flag on the `users` table
- **`free`** — daily rate-limited ([`lib/rate-limit.ts`](lib/rate-limit.ts), [`lib/usage-daily.ts`](lib/usage-daily.ts))

## Development

```sh
npm install
npm test            # jest (ESM via ts-jest)
npx jest test/lesson-v3-validators.test.ts   # single file
node index.js       # local dev (rarely needed; deploy target is Vercel)
```

### Environment

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
SUBSCRIPTION_GATE_ENABLED=false   # set true to enforce free-tier limits
```

See `env.example` for the full list.

## Specialized docs

- [`docs/API-ROUTE-CONSOLIDATION.md`](docs/API-ROUTE-CONSOLIDATION.md) — keeping within the Vercel function limit.
- [`docs/WIKIMEDIA-AUTH.md`](docs/WIKIMEDIA-AUTH.md) — authenticated Wikimedia Commons for better rate limits.
- [`docs/archive/`](docs/archive/) — point-in-time test/audit reports.

## Conventions

- **Gemini only** — do not introduce other AI providers.
- **Errors return HTTP 200** with `{ success: false, ... }`.
- **`unused_store_do_not_delete/`** holds archived handlers — do not delete or activate them.
- Age rules in `lib/lesson-age.ts` are the single source of truth for both API prompts and app validation.
