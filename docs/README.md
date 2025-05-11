# Owlby API Documentation

## Project Overview

Owlby API is the backend for the Owlby platform, now fully separated from the web and mobile app codebases. It is deployed independently at https://api.owlby.com.

## Architecture
- **Backend:** Node.js, Express
- **Deployment:** Vercel (serverless)

## Quick Start
1. Clone the repo and install dependencies
2. Run the API locally with `npm start`
3. Test the health endpoint at http://localhost:3001/api/health

## Deployment
- Deployed on Vercel
- Custom domain: https://api.owlby.com
- See `vercel.json` for configuration

## Environment Variables
- Add secrets/config in the Vercel dashboard under Project Settings → Environment Variables

## API Endpoints
- `/api/health`: Health check endpoint
- (Add more endpoints as the API grows)

## Contact
For more details, see the main Owlby documentation or contact the team. 