# API route consolidation (Vercel free tier ≤12 functions)

**Current:** 8 serverless functions (after Option 1 + 2 consolidation).

| # | Route file | Purpose |
|---|------------|--------|
| 1 | `api/profile.ts` | GET profile, POST update, DELETE account; **+** GET `?scope=health` (no auth), GET `?scope=subscription` (auth) |
| 2 | `api/email.ts` | POST send/resend verification; GET/POST with token = verify (consume link) |
| 3 | `api/story/generate-story.ts` | Story generation |
| 4 | `api/learn/generate-lesson.ts` | Lesson generation |
| 5 | `api/chat/generate-response.ts` | Chat response |
| 6 | `api/feedback/submit.ts` | Feedback submission |
| 7 | `api/achievements/sync.ts` | Achievements sync |
| 8 | `api/webhooks/revenuecat.ts` | RevenueCat webhook |

Your `vercel.json` rewrites already map many public paths to these; the app calls the rewritten URLs. Consolidating **files** and updating rewrites keeps the same public API, so the app does not need to change.

---

## Option 1: Merge email into one route (10 → 9)

**Idea:** One handler for all email flows: send, resend, and verify (consume token).

- **New file:** `api/email.ts`
  - **POST** with auth, no `token` in body → send or resend (use `action=send|resend` from query/body).
  - **GET or POST** with `token` in query or body → verify (consume token, redirect or JSON).
- **Remove:** `api/email-verification.ts`, `api/verify-email.ts`.
- **Rewrites:** Point `/api/verify-email`, `/api/send-verification`, `/api/resend-verification` to `/api/email` (with query params as needed).

**Effort:** Low. Logic is already split by “has token” vs “has action”.

---

## Option 2: Merge status into profile (10 → 9, or 9 → 8 with Option 1)

**Idea:** Handle health and subscription from the profile route so you can delete `api/status.ts`.

- **Change:** `api/profile.ts`
  - **GET** with no auth and `?scope=health` → return health JSON (same as current status).
  - **GET** with auth and `?scope=subscription` → return subscription JSON (same as current status).
  - **GET** with auth and no scope → existing profile response.
  - POST/DELETE unchanged.
- **Remove:** `api/status.ts`.
- **Rewrites:** Point `/health`, `/api/health`, `/subscription-status`, `/api/subscription-status` to `/api/profile?scope=health` or `?scope=subscription`.

**Effort:** Low. Profile must allow unauthenticated GET only when `scope=health`.

---

## Option 3: Single “generate” route for AI (saves 2; 10 → 8, or 8 → 6 with 1+2)

**Idea:** One function for story, lesson, and chat generation.

- **New file:** `api/generate.ts`
  - Body or query: `type: 'story' | 'lesson' | 'chat'`.
  - Shared: CORS, auth, rate limit, subscription gate, then dispatch to story/lesson/chat logic (import from current handlers or inlined).
- **Remove:** `api/story/generate-story.ts`, `api/learn/generate-lesson.ts`, `api/chat/generate-response.ts`.
- **Rewrites:** Point `/api/story/generate-story`, `/api/learn/generate-lesson`, `/api/chat/generate-response` (and any path variants) to `/api/generate` with the right `type` (or keep path and use a single `api/generate.ts` with path-based routing if you use a catch-all).

**Trade-off:** One larger serverless bundle (all AI deps in one function). Stay under Vercel’s size limit (e.g. 50MB compressed). If you’re well under today, this is usually fine.

**Effort:** Medium. Requires a small dispatcher and shared request parsing.

---

## Recommended combination

- **Do Option 1 + Option 2:** email → 1 route, status → profile. **Result: 8 functions**, same public API.
- **Optionally add Option 3** if you want more headroom: **6 functions** total.

Final layout example (8 functions):

1. `api/profile.ts` (profile + health + subscription)
2. `api/email.ts` (send, resend, verify)
3. `api/story/generate-story.ts`
4. `api/learn/generate-lesson.ts`
5. `api/chat/generate-response.ts`
6. `api/feedback/submit.ts`
7. `api/achievements/sync.ts`
8. `api/webhooks/revenuecat.ts`

Or with Option 3 (6 functions): replace the three generate files with `api/generate.ts`.

---

## Vercel limit reminder

Free tier: 12 serverless functions. You’re at 10, so you have room; consolidation is to free slots for future routes or to simplify. After any change, redeploy and confirm all rewritten URLs still hit the intended handler.
