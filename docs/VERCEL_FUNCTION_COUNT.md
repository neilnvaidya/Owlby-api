# Vercel Serverless Function Count (12 limit)

## Current count: 12 functions (after removing update-profile)

| # | File | Purpose |
|---|------|--------|
| 1 | `api/health.ts` | Health check |
| 2 | `api/profile.ts` | GET profile, POST update |
| 3 | ~~`api/update-profile.ts`~~ | **REMOVED** – was unused (app uses `POST /api/profile` only) |
| 4 | `api/delete-account.ts` | DELETE account |
| 5 | `api/verify-email.ts` | Verify email (token from link) |
| 6 | `api/send-verification.ts` | Send verification email – **not called by app or web** |
| 7 | `api/resend-verification.ts` | Resend verification email |
| 8 | `api/chat/generate-response.ts` | Chat AI |
| 9 | `api/story/generate-story.ts` | Story AI |
| 10 | `api/learn/generate-lesson.ts` | Lesson AI |
| 11 | `api/feedback/submit.ts` | Feedback |
| 12 | `api/achievements/sync.ts` | Achievements sync |
| 13 | `api/legal/[doc].ts` | Privacy / Terms text |

---

## Recommended reductions

### 1. Merge `delete-account` into `profile` (saves 1 → 12)

- In `api/profile.ts`, handle `DELETE` the same way `api/delete-account.ts` does.
- Remove `api/delete-account.ts`.
- In `vercel.json`, add rewrite: `"/delete-account" → "/api/profile"` (request method stays `DELETE`).
- App already calls `DELETE /api/delete-account`; after rewrite it hits `profile` with `DELETE`; no app change if you keep the path via rewrite.

### 2. Merge all email/verification into one `api/email.ts` (saves 2 → 10)

- Add `api/email.ts` that:
  - **GET** with `?token=...` → same logic as `verify-email.ts`.
  - **POST** with `body.action === 'resend'` → same logic as `resend-verification.ts`.
  - **POST** with `body.action === 'send'` → same logic as `send-verification.ts` (if you still need it).
- Remove `api/verify-email.ts`, `api/resend-verification.ts`, `api/send-verification.ts`.
- Rewrites:  
  `"/verify-email" → "/api/email"`  
  `"/resend-verification" → "/api/email"`  
  `"/send-verification" → "/api/email"`
- **App changes:**  
  - Call `POST /api/email` with `{ action: 'resend' }` instead of `POST /api/resend-verification`.  
  - Email verification links should point to `GET /api/email?token=...` (or keep `/verify-email?token=...` and rewrite so it hits `/api/email`; then the handler must know “verify” from path or from absence of `action` and presence of `token`).

So either:

- **A)** Single path `/api/email`: verify link = `https://api.owlby.com/api/email?token=...`, and resend = `POST /api/email` with `{ action: 'resend' }`.  
- **B)** Keep paths with rewrites: `/verify-email` and `/resend-verification` rewrite to `/api/email`; handler reads `req.url` or a header (if Vercel sends original URL) to choose verify vs resend. If Vercel does not send original path, use **A**.

### 3. ~~Remove or merge `update-profile`~~ **DONE** (saves 1 → 12)

- **Done:** Deleted `api/update-profile.ts` and removed the `/update-profile` rewrite. No app or web code called this endpoint (app uses `GET/POST /api/profile` only).

---

## After changes

| Action | Functions before | After |
|--------|-------------------|--------|
| Start | 13 | 13 |
| Merge delete-account → profile | 13 | 12 |
| Merge verify + send + resend → email | 12 | 10 |
| Remove update-profile (done) | 13 | **12** |

You are now at the 12-function limit. Further reductions: merge delete-account → profile, or merge the 3 email endpoints → one.

---

## Optional: single router (1 function)

To use only **one** serverless function, add a catch-all (e.g. `api/[[...path]].ts` or your framework’s equivalent) that:

- Reads the path (e.g. `req.url` or `path` array).
- Dispatches to the same logic currently in each of the 13 files (import and call their handlers or inlined logic).

Then delete the other 12 files and route all current paths to this single handler via `vercel.json` rewrites. This is a larger refactor but gets you to 1 function.
