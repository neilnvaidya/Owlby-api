# API test results — analysis

**Source:** `api-test-results.jsonl` (36 records)  
**Scope:** Health, Chat, Lesson, Story against api-dev.owlby.com  
**Reference:** `lib/ai-schemas.ts`, route handlers in `api/`

---

## 1. Run overview

| Run   | Routes        | promptSetId | Notes |
|-------|----------------|-------------|--------|
| 1     | health→chat→lesson→story | (none) | Legacy run, set 1 prompts |
| 2     | health→chat→lesson→story | (none) | Legacy run, set 1 prompts |
| 3     | health→chat→lesson→story | 3 | Day/night, space |
| 4     | health→chat→lesson→story | 2 | Volcanoes |
| 5     | health→chat→lesson→story | 4 | Bees, pollination |
| 6     | health→chat→lesson→story | 1 | Rainbows, light |
| 7     | health→chat→lesson→story | 5 | Fish, gills — **story failed** |
| 8     | health→chat→lesson→story | 5 | Fish, gills — story succeeded (retry?) |
| 9     | health→chat→lesson→story | 2 | Volcanoes |

So: **9 health**, **9 chat**, **9 lesson**, **9 story** calls. One story response is a failure (body `success: false`).

---

## 2. Response form and validity

### 2.1 Health (`/api/profile?scope=health`)

**Expected form:**  
- HTTP 200, JSON with at least `status`, `timestamp`, `service`, `version`.

**Observed:**  
- All 9: status 200, body has `status: "ok"`, `timestamp`, `service: "owlby-api"`, `version: "1.0.0"`.  
- No extra or missing top-level fields.

**Verdict:** **Valid.** Shape is consistent and matches a minimal health contract.

---

### 2.2 Chat (`/api/chat/generate-response`)

**Expected form (from `chatResponseSchema` + handler):**  
- Root: `response_text` (required), `interactive_elements` (required).  
- `response_text`: `main` (required), `follow_up` (optional).  
- `interactive_elements`: `followup_buttons` (array), `story_button` (object with `prompt`), `learn_more` (object with `topic`).  
- Handler also returns `chatId`, `gradeLevel`, `success`, and may add `requiredCategoryTags`, `optionalTags`.

**Observed:**  
- All 9: HTTP 200, `body.success === true`.  
- All have `response_text.main` (string, 300–1000 chars range respected in practice), `response_text.follow_up` (string, ends with `?` where checked).  
- All have `interactive_elements.followup_buttons` (array of 2–3 strings), `interactive_elements.story_button.prompt`, `interactive_elements.learn_more.topic`.  
- **Form quirks:**  
  - Schema says `follow_up` optional; every response includes it — fine.  
  - Some responses carry `requiredCategoryTags: []`, `optionalTags: []` (set by handler after tags API removal) — consistent.

**Verdict:** **Valid.** Structure matches schema and handler expectations.

---

### 2.3 Lesson (`/api/learn/generate-lesson`)

**Expected form (from `lessonResponseSchema` + `processLessonResponse`):**  
- Top level (after processing): `topic`, `gradeLevel`, `title`, `introduction`, `body` (array of strings), `conclusion`, `keyPoints`, `keywords` (array of `{ term, definition }`), `challengeQuiz.questions` (each with `question`, `options`, `correctAnswerIndex`, `explanation`), `difficulty`, `tags`, `requiredCategoryTags`, `optionalTags`, `success`.

**Observed:**  
- All 9: HTTP 200, `body.success === true`.  
- All have: `title`, `introduction`, `body` (array, 2+ items), `conclusion`, `keyPoints`, `keywords` (array of term/definition objects), `challengeQuiz.questions` (2 questions each; each has `question`, `options`, `correctAnswerIndex`, `explanation`).  
- **Form quirks:**  
  - `tags`: sometimes `[]`, sometimes e.g. `["EXPERIMENTS_DISCOVERY","CREATIVITY_ARTS"]` or other category-like strings. So the field is used for a mix of “raw” tags and category tags; `requiredCategoryTags` / `optionalTags` are the normalized achievement tags. Semantics are a bit overloaded but present in every response.  
  - `difficulty`: always `5` in this set — narrow range.  
  - `optionalTags` sometimes look like tokenized title words (e.g. `["The","Magic","of"]`) rather than meaningful tags — **low value** for discovery/filtering.

**Verdict:** **Valid.** Required fields and shapes are present; tag semantics and optionalTag quality are worth tightening.

---

### 2.4 Story (`/api/story/generate-story`)

**Expected form (from `storyResponseSchema` + `processStoryResponse`):**  
- Success: `prompt`, `gradeLevel`, `title`, `content` (array of strings), `characters`, `setting`, `moral`, `tags`, `timestamp`, `requiredCategoryTags`, `optionalTags`, `success: true`.  
- Failure: handler can return HTTP 200 with `success: false`, `error`, `userMessage` (e.g. from `api-handler` catch).

**Observed:**  
- **8 successes:** All have `title`, `content` (array of 2–3 paragraphs), `characters`, `setting`, `moral`, `tags`, `timestamp`, `requiredCategoryTags`, `optionalTags`, `success: true`.  
- **1 failure (record with promptSetId 5, prompt “a curious fish exploring the reef”):**  
  - HTTP 200, `body.success === false`, `body.error === "Something went wrong. Please try again."`, `body.userMessage` same, `body.prompt` present.  
  - No `title`, `content`, `characters`, etc. So the route returns 200 even on AI/server failure and signals failure only via `body.success` — **clients must check `body.success`**, and the test script’s “status 200” does not imply a successful story.  
- **Form quirks:**  
  - Same as lesson: `optionalTags` often tokenized or low-value (e.g. `["Leo","and","the"]`).  
  - `tags` mixes category-style tags (e.g. `READING_STORIES`, `ANIMALS_NATURE`) with optional; normalization is present but optional-tag content is weak.

**Verdict:** **Structurally valid** (success and error shapes both match handler behavior). **One content failure**; design of returning 200 + `success: false` is valid but easy to misinterpret.

---

## 3. Value assessment (critical)

- **Health:** No content value; only confirms service is up.  
- **Chat:**  
  - Answers are on-topic, grade-appropriate, and use bold terms and follow-ups.  
  - **Value:** High for the intended use (quick, complete answers with follow-up and learn_more/story hooks).  
  - **Caveat:** No independent fact-check; we assume correctness.  
- **Lesson:**  
  - Topics are covered with title, intro, body, conclusion, key points, keywords, and quiz.  
  - **Value:** High for structured, single-topic lessons.  
  - **Caveats:** `optionalTags` often useless (tokenized words); difficulty is always 5; no check that quiz correctAnswerIndex is in range or that options are distinct.  
- **Story:**  
  - When successful, stories match the prompt, have clear characters/setting/moral.  
  - **Value:** Good for short, prompt-driven narratives.  
  - **Caveats:** One failure with a generic message (no reason); `optionalTags` again often tokenized; no check on paragraph length or appropriateness.  

**Failure:** The single story failure (set 5, “a curious fish exploring the reef”) took ~12.5 s then returned the generic “Something went wrong” — likely an AI/parsing/timeout path in `api-handler`; no retry is visible in the same record, and a later run with the same set 5 succeeded.

---

## 4. Timing comparison

All durations in ms. Summary by route:

| Route  | Count | Min    | Max     | Mean (approx) | Notes |
|--------|-------|--------|---------|----------------|-------|
| health | 9     | 303    | 497     | ~370           | Stable, sub-500 ms. |
| chat   | 9     | 2,611  | 4,395   | ~3,200         | 2.6–4.4 s; one outlier ~4.4 s. |
| lesson | 9     | 2,875  | 4,605   | ~3,400         | 2.9–4.6 s; one ~4.6 s. |
| story  | 9     | 1,918  | 25,997  | ~7,500         | **Wide spread:** one 26 s, one 12.6 s (failed), rest 2–3 s. |

**Per-run total (health + chat + lesson + story):**

- Run 1: 343 + 2726 + 3440 + 25997 ≈ **32.5 s** (story ~26 s).  
- Run 7 (set 5, story failed): 303 + 2692 + 3521 + 12558 ≈ **18.9 s** (story ~12.6 s then failure).  
- Typical run (e.g. run 4): 313 + 2922 + 2942 + 2465 ≈ **8.6 s**.

So:

- **Health:** Consistent and fast.  
- **Chat and lesson:** Similar bands (roughly 2.5–4.5 s); acceptable for interactive use.  
- **Story:** Highly variable; one 26 s and one 12.6 s (failed) dominate the average. Story is the main latency and reliability risk.

---

## 5. Summary table (by record type)

| Route  | HTTP status | Body.success | Form valid | Value       | Timing        |
|--------|------------|--------------|------------|------------|---------------|
| health | 200 (9/9)  | N/A          | Yes        | N/A        | 303–497 ms    |
| chat   | 200 (9/9)  | true (9/9)   | Yes        | High       | 2.6–4.4 s     |
| lesson | 200 (9/9)  | true (9/9)   | Yes        | High*      | 2.9–4.6 s     |
| story  | 200 (9/9)  | true (8/9)   | Yes        | Good / 1 fail | 1.9–26 s (high variance) |

\*Lesson value is high; tag and difficulty usage need improvement.

---

## 6. Recommendations

1. **Story:**  
   - Treat **story as the main reliability and latency risk.**  
   - Investigate the failure (set 5, “a curious fish exploring the reef”) and the 26 s success in run 1 (timeout/retry/fallback behavior).  
   - Consider retries or user-visible loading/timeout for story.

2. **Contract:**  
   - Either return **4xx/5xx** for story when `success: false`, or document clearly that **clients must check `body.success`** for story (and optionally lesson/chat) and not rely on HTTP status alone.

3. **Tags:**  
   - **Lesson and story:** Improve or restrict `optionalTags` so they are not tokenized title words; consider omitting them when not meaningful.

4. **Tests:**  
   - Add assertions on `body.success` for chat/lesson/story so a 200 with `success: false` is reported as a failure in the test script and in any aggregated “pass” count.

5. **Monitoring:**  
   - Track story latency (p50/p95/p99) and story failure rate separately; set alerts for high latency and for “Something went wrong” from the story route.
