# Media image audit report

Based on `media-image-audit.json`: Commons search results for 20 multi-word queries. For each search, **recommended result** = which filename (by position) is most sensible to serve for educational/display use.

---

## Recommended image per search

| Search | Best position (1-based) | Recommended filename | Notes |
|--------|-------------------------|----------------------|--------|
| honey bee | **6** | European honey bee extracts nectar.jpg | #1 is spider with prey; #5–6 are clear honey bee photos |
| prism optical | **5** | The optical dispersion.jpg | #1 is dichroic prism (complex); #5 is likely simpler optical dispersion |
| flamingo bird | **1** | Lightmatter flamingo2.jpg | First result is on-topic and clear |
| volcano eruption | **4** | Taal Volcano eruption on January 12, 2020.jpg | #1 is atmospheric plume; #3–4 are clear eruption photos |
| rainbow sky | **5** | Rainbow in sky 2.jpg | #1 is shuttle launch; #4–5 are literal “rainbow sky” |
| sun star | **4** | The life cycle of a Sun-like star (annotated).jpg | Many PDFs/webm; #4 is an image, educational |
| moon night | **4** | Full moon at night.jpg | Clear match |
| fish ocean | **—** | *(none strong)* | #1 is aquarium building; #2–11 are “Ocean Fish Bar” chip shops. Need different search or filter |
| tree nature | **8** | Trees during the sunset in Gulf Islands National Park Reserve, Sidney Island, BC, Canada.jpg | First few are Dutch botanical close-ups; #8 is clear landscape |
| butterfly insect | **1** | Peacock butterfly (Aglais io) 2.jpg | On-topic; #12 “Butterfly Insect.jpg” also good |
| dinosaur fossil | **2** | Peinten dinosaur fossil-2.jpg | #1 is park building; #2 is actual fossil |
| planet space | **4** | Neptune Full.jpg | #2–3 are artist impression/people; #4 is clear planet image |
| pyramid Egypt | **6** | Pyramid - Giza, Egypt.jpg | #2 “All Gizah Pyramids.jpg” or #6 both good |
| water cycle | **3** | Water Cycle-en.png | Diagram, good for education; #9 Simplified-water-cycle.jpg also good |
| atom science | **2** | Atom needpix.png | Many results are “Cold Atom Lab” (NASA); #2 has “atom” in name, likely icon/diagram |
| coral reef ocean | **1** | Coral Reef, Indian Ocean.jpg | Strong first result |
| tadpole frog | **2** | Iberian marsh frog (Pelophylax perezi) tadpole.jpg | #1 is “Tadpole House, Frog Lane” (building) |
| quartz crystal | **1** | Quartz, Tibet.jpg | Good; #10 “A clear quartz crystal with natural features.jpg” also good |
| aurora northern lights | **1** | Aurora borealis over Eielson Air Force Base, Alaska.jpg | Strong first result |
| hummingbird bird | **1** | Volcano hummingbird (Selasphorus flammula) female in flight 2.jpg | All first results are on-topic |

**Summary:** For 14 of 20 searches, the best result is **not** position 1. For one (fish ocean) there is no good result in the top 15. So “always use first result” is often wrong.

---

## Problems observed

1. **Off-topic first results**: Building names (“Tadpole House”, “Ocean Fish Bar”), parks (“Dinosaur Park”), or technical items (dichroic prism instead of simple prism).
2. **Query–result mismatch**: “fish ocean” returns many “Ocean Fish Bar” (chip shops); “sun star” returns star lifecycle PDFs and videos.
3. **Complex vs simple**: “prism optical” #1 is a dichroic prism; a simpler “optical dispersion” image appears later.
4. **Wrong type**: PDFs, SVGs, webm appear in search results; we already filter to BITMAP when serving, but the “best position” in the list often isn’t #1.

---

## Strategies to improve which image we serve

### 1. **Similarity / keyword overlap (search vs filename)**

- Normalize search and filename: lowercase, strip extension, split into words.
- Score each result by how many **search terms** appear in the **filename** (or in Commons metadata if we had it).
- Example: search “honey bee” → “Honey bee portrait” scores 2; “Thomisus onustus with Apis mellifera” scores 0 for the phrase (even though it’s a bee). Prefer higher overlap.
- **Implementation**: For each result, `filenameWords = filename.replace(/\.[a-z0-9]+$/i, '').toLowerCase().split(/[\s_\-–—]+/)`; `searchWords = search.toLowerCase().split(/\s+/)`; score = number of `searchWords` that appear in `filenameWords`. Pick first result with score ≥ 1, or result with highest score in top N.

### 2. **Good search phrases from Gemini (primary lever)**

- Don't rely on a blocklist (it doesn't generalise). Ask Gemini for short, descriptive Wikimedia search phrases (e.g. "honey bee", "prism optical"). Good queries yield better first-page results; similarity scoring picks the best filename match.

### 3. **Prefer “simple” filenames in tie-break**

- Shorter, descriptive filenames (e.g. “Rainbow sky.jpg”, “Full moon at night.jpg”) often correspond to clear, single-subject images.
- Long strings of IDs, codes, or “(IA ...).pdf” usually are diagrams, books, or data. Use length or pattern as a tie-breaker after similarity.

### 4. **Use search phrasing (already doing)**

- Multi-word searches (“flamingo bird”, “prism optical”) already improve relevance vs single words. Keep generating these (e.g. from Gemini) and pass them through as the Commons query.

### 5. **Iterate over results with scoring (don't assume position 1)**

- Don't take the first Commons result. Score each by search-term overlap in the filename, sort by score, return the first valid BITMAP. No blocklist; similarity alone.

### 6. **Optional: ask Commons for “image” only**

- If the search API supports a filter by media type (e.g. only images, no PDFs), use it so PDFs/shops don’t dominate. (Needs a quick check of Commons REST API docs.)

---

## Implemented

1. **Similarity scoring only** in `lib/wikimedia-commons.ts`: each Commons result is scored by search-term overlap in the filename (word match = 2, substring = 1). Results are sorted by score descending; we return the first valid BITMAP. No blocklist—relies on good search phrases and scoring to generalise.
2. **Search query contract**: Callers should pass short, descriptive phrases suitable for Wikimedia (e.g. from Gemini: "honey bee", "prism optical"). The API uses each tag as the Commons search query; better phrases yield better results.
3. **Verification script** `scripts/media-image-verify-api.js`: calls the API for each audit tag and writes `media-image-api-verify.json`. Run after deploy and compare to the Recommended column above.

---

## How to verify

1. Deploy the API (or run locally: `npx vercel dev` then `OWLBY_API_BASE_URL=http://localhost:3000 node scripts/media-image-verify-api.js`).
2. Run: `node scripts/media-image-verify-api.js`
3. Open `media-image-api-verify.json` and compare each tag's `filename` to the **Recommended filename** in the table at the top of this report.
