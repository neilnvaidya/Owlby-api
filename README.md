# Owlby API

## Overview

This is the backend API for the Owlby platform. It is now fully separated from the web and mobile app codebases, and is deployed independently (e.g., at https://api.owlby.com).

## Tech Stack
- Node.js
- Express
- Deployed on Vercel (serverless)

## Local Development

```bash
npm install
npm start
```

The API will run on http://localhost:3001 by default.

### Health Check
Visit http://localhost:3001/api/health to verify the API is running.

## Deployment

- This project is deployed on Vercel.
- Custom domain: https://api.owlby.com
- See `vercel.json` for serverless configuration.

## Environment Variables
- Add any required secrets or config in the Vercel dashboard under Project Settings → Environment Variables.

## Project Structure
- `index.js`: Main Express server and API routes
- `package.json`: Dependencies and scripts

## Contact
For questions or issues, see the main Owlby documentation or contact the team. 