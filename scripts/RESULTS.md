# Chat instruction timing results

User prompt: **"What are rainbows?"**  
Response times in **milliseconds**. Multiple runs shown as `first / second` when available.

Models match **`lib/config.ts`** (Gemini only): `gemini-3.1-flash-lite-preview`, `gemini-3-flash-preview`, `gemini-2.5-flash`, `gemini-2.5-pro`.

## Response time by model and parts

| Model                            | body only   | body + targetAudience | + responseRequirements | + outputRules | + contextAndClose |
| -------------------------------- | ----------- | --------------------- | ---------------------- | ------------- | ----------------- |
| **gemini-3.1-flash-lite-preview**| 3,953       | 3,807                 | 2,847                  | 3,001         | 2,751             |
| **gemini-3-flash-preview**       | 6,645       | 7,128                 | 7,798                  | 8,353         | 6,546             |
| **gemini-2.5-flash**             | 7,788 / 7,708 | 6,235               | 6,227                  | 6,879         | 6,278             |
| **gemini-2.5-pro**              | —           | —                     | —                      | —             | —                 |

Fill in columns as you run API route tests; prompts come from `api-route-test-config.js` (5 prompt sets, one chosen at random per run).

## Notes

- **Gemini 3.x**: Responses may include non-text parts (`thoughtSignature`). SDK returns concatenation of text parts only.
- **gemini-3.1-flash-lite-preview**: Earlier run with body + targetAudience + outputRules (responseRequirements skipped) was 3,070 ms.

---

## Sample runs (terminal output)

<details>
<summary>Click to expand: full terminal output (lines 7–189)</summary>

```text
node scripts/api-route-test.js all
# Runs: health → chat → lesson → story (prompt set chosen at random).
# Results append to api-test-results.jsonl.
```
</details>

---

*API route tests: `node scripts/api-route-test.js health|chat|lesson|story|all` against api-dev.owlby.com. Set `OWLBY_TEST_TOKEN` for auth.*
