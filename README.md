# Owlby API

This is the backend API for the OwlbyAI platform, providing secure, AI-powered chat and user profile management for the mobile app. Developed by OwlbyAI LLP.

## MVP Endpoints
- **POST /api/chat/response** — AI-powered chat response and lesson generation
- **GET /api/profile** — Fetch user profile (Auth0 authenticated)
- **POST /api/profile** — Update user profile (Auth0 authenticated)
- **Auth0 integration** — Secure authentication for all endpoints

For business vision and roadmap, see [../PRODUCT_VISION.md](../PRODUCT_VISION.md).

## Project Structure
- **/api/** — Serverless API endpoints (chat, profile, auth)
- **/lib/** — Shared library code and utilities
- **/test/** — API tests

## Setup & Development
1. Install dependencies:
   ```sh
   npm install
   ```
2. Set up your `.env` file:
   ```env
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   AUTH0_DOMAIN=YOUR_AUTH0_DOMAIN
   AUTH0_CLIENT_ID=YOUR_AUTH0_CLIENT_ID
   AUTH0_CLIENT_SECRET=YOUR_AUTH0_CLIENT_SECRET
   ```
3. Run locally (if supported):
   ```sh
   npm run dev
   ```
4. Deploy to Vercel for production.

## Codebase Inventory
- **api/chat/response.ts** — Chat and lesson generation endpoint
- **api/profile.ts** — User profile endpoints
- **api/health.ts** — Health check endpoint
- **lib/** — Shared utilities and Gemini AI integration
- **test/** — API tests

## Notes
- All non-MVP endpoints and features have been removed for focus and clarity.
- For mobile app and web landing page setup, see their respective READMEs.

---
For business and product direction, see [../PRODUCT_VISION.md](../PRODUCT_VISION.md). 