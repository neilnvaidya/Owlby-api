# Chat instruction timing results

User prompt: **"What are rainbows?"**  
Response times in **milliseconds**. Multiple runs shown as `first / second` when available.

## Response time by model and parts


| Model                      | body only       | body + targetAudience | + responseRequirements | + outputRules | + contextAndClose |
| -------------------------- | --------------- | --------------------- | ---------------------- | ------------- | ----------------- |
| **gemini-2.5-flash**       | 7,788 / 7,708   | 6,235                 | —                      | —             | —                 |
| **gemini-3-flash-preview** | 6,645           | 7,128                 | 7,798                  | 8,353         | 6,546             |
| **gemini-3-pro-preview**   | 16,557          | —                     | —                      | —             | —                 |
| **gemini-3.1-pro-preview** | 14,471 / 12,324 | —                     | —                      | —             | —                 |
| **deepseek-chat**          | 15,596          | —                     | —                      | —             | —                 |
| **deepseek-reasoner**      | 19,035          | —                     | —                      | —             | —                 |


Fill in columns as you run with more `PARTS_INCLUDED` in `gemini-test.js` or `deepseek-test.js`.

## Notes

- **Gemini 3.x pro preview**: Responses include non-text parts (`thoughtSignature`). SDK returns concatenation of text parts only.
- **DeepSeek**: Set `MODEL` in `deepseek-test.js` (e.g. `deepseek-chat`, `deepseek-reasoner`). Body-only runs: deepseek-chat 25.2 s / 15.6 s / 15.6 s; deepseek-reasoner 19.0 s.

---

*Ignore cancelled runs and path typos. Use `node scripts/deepseek-test.js` and `node scripts/gemini-test.js`.*