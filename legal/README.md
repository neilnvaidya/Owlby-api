# Legal documents (single source of truth)

Edit the `.txt` files here. They are served by the API at `/api/legal/privacy-policy` and `/api/legal/terms`, and consumed by:

- **Owlby app**: Legal modal in onboarding (plain text on white).
- **Owlby web**: Privacy and Terms pages can fetch from API or stay static; if you switch web to API, both app and web use this source.

Use plain text. Section headers and paragraphs separated by blank lines. Bullet lists with "- " prefix.
