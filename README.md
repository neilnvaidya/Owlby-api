# Owlby API

## Overview
This is the backend API for the Owlby platform. It provides AI-powered chat and other endpoints, and is designed to be deployed as serverless functions on Vercel, using a dedicated subdomain (e.g., https://api.owlby.com).

## Architecture
- **Serverless-first:** Endpoints are implemented as serverless functions in the `/api` directory.
- **Express (local only):** You may use Express for local development, but Vercel only uses the `/api` directory.
- **Deployed on Vercel:** Uses Vercel for production, with a custom domain and environment variables.
- **Auth0:** Used for authentication and API protection.
- **Gemini API:** Google Generative AI powers the chat endpoint.

## Local Development

### Using Vercel Dev (Recommended)
Run the API locally as Vercel serverless functions:
```sh
npx vercel dev
```
- Endpoints available at `http://localhost:3000/api/...`
- Mimics production environment.

### Using Express (for legacy/testing only)
If you want to use Express, you must manually mount endpoints. This is not used in production.

## Production Deployment
- Push to GitHub; Vercel auto-deploys.
- Custom domain: https://api.owlby.com (set up CNAME in your DNS to Vercel)
- Set environment variables (e.g., `GEMINI_API_KEY`) in Vercel dashboard.
- All endpoints are available at your custom domain.

## API Endpoints

### Health Check
- **GET `/api/health`**
- Returns `{ "status": "ok" }`

### Chat Response
- **POST `/api/chat/response`**
- Body: `{ "message": "<user message>", "chatId": "<chat id>" }`
- Returns: `{ "response": "<AI reply>", "chatId": "<chat id>" }`
- Only POST is allowed; GET returns 405.

## Auth0 Integration
- **API Identifier (audience):** `https://api.owlby.com`
- **Allowed Callback URLs:**
  - For mobile: `exp://<your-ip>:8081/--/auth0/callback`, `owlby://auth0/callback`
  - For web: `https://owlby.com/login/callback`, `https://auth0.owlby.com/login/callback`
- Update these in the Auth0 dashboard as needed.

## Gemini API Region Notes
- Gemini API may be region-locked. If you see a message like "I'm not available in your region," deploy to Vercel (US region) to resolve.
- Local development may be blocked by Gemini region restrictions.

## Troubleshooting
- **405 Method Not Allowed:** Only POST is allowed for `/api/chat/response`.
- **Region Lock:** If Gemini is not available in your region, deploy to Vercel.
- **Module Not Found:** Ensure all dependencies (e.g., `@google/generative-ai`) are in `dependencies`, not `devDependencies`.
- **404 on /api/health:** Make sure you have a serverless function at `/api/health.ts`.

## Testing Endpoints
- Use curl or Postman:
  ```sh
  curl -X POST https://api.owlby.com/api/chat/response \
    -H "Content-Type: application/json" \
    -d '{"message":"hello","chatId":"default"}'
  ```
- Health check:
  ```sh
  curl https://api.owlby.com/api/health
  ```

## Automated Testing (Jest + Supertest)

- Minimal test setup is present using `jest`, `ts-jest`, and `supertest`.
- To run all tests:
  ```sh
  npm test
  ```
- Tests require a valid `GEMINI_API_KEY` in your `.env` file for Gemini API access.
- If your region is not supported by Gemini, tests will pass and return a fallback message indicating region lock.
- Example: See `api/chat/response.test.ts` for endpoint tests.

## Updating & Redeploying
- Make code changes, commit, and push to GitHub.
- Vercel will auto-deploy.
- Check Vercel logs for errors and debugging.

## Contact & Support
- See the main Owlby documentation or contact the team for questions.

## Tech Stack
- Node.js
- Express
- Deployed on Vercel (serverless)

## Project Structure
- `index.js`: Main Express server and API routes
- `package.json`: Dependencies and scripts

## Environment Variables
- Add any required secrets or config in the Vercel dashboard under Project Settings → Environment Variables.

## Contact
For questions or issues, see the main Owlby documentation or contact the team.

## API Endpoints

- Place serverless function endpoints in the `api/` directory at the root of this repo. For example, `api/chat/response.ts` for the chat endpoint.

## Privacy & Data Retention
- Chat data is not stored persistently. Only summaries/insights are extracted and retained for tailoring the AI prompt. Raw chat is discarded at session end.

## Supabase Integration
- Supabase is not required for MVP. It will be integrated post-MVP for storing learning insights, learning paths, and advanced user data.

## Profile Endpoints
- User profile endpoints and advanced features are planned for post-MVP.

## TypeScript Typing
- Improving TypeScript types for API handlers is a post-MVP task unless the API is expanded sooner.

## Known Issues & Limitations
- Automated UI/component tests are not required for the API. 