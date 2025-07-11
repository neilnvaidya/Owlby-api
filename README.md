# Owlby API

This repository contains the backend API for the OwlbyAI learning platform, developed by OwlbyAI LLP. It is a Node.js application designed to be deployed as serverless functions on Vercel.

## Purpose

This API serves as the backend for the `Owlby-app` mobile application. Its primary responsibilities include:
- Handling user profile creation and updates.
- Processing chat messages and generating AI-powered responses.
- Generating dynamic lessons and quizzes based on user interactions.
- Securely authenticating and authorizing all incoming requests.

## Project Structure

- **/api/**: Contains all the serverless function endpoints, organized by feature.
- **/lib/**: Shared libraries, utility functions, and type definitions (e.g., Supabase client, auth helpers).
- **/test/**: API integration and unit tests.

## API Endpoints

The following are the core API endpoints:

- `POST /api/chat/generate-response`: Powers the conversational learning feature.
- `GET /api/profile`: Retrieves a user's profile data.
- `POST /api/profile`: Creates or updates a user's profile.
- `DELETE /api/delete-account`: Handles user account deletion requests.
- `POST /api/feedback/submit`: Collects user feedback.
- `GET /api/health`: A simple health check endpoint.

All endpoints are secured and require a valid authentication token.

## Getting Started

### Prerequisites

- Node.js (LTS version)
- Yarn or npm
- A Vercel account for deployment.
- A Supabase project for the database.
- An `.env` file with the necessary environment variables (see `.env.example`).

### Installation & Development

1.  **Clone the repository:**
    ```sh
    git clone <repository-url>
    cd Owlby-api
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file and populate it with your keys for the database, AI model, and authentication provider.

4.  **Run the development server:**
    ```sh
    npm run dev
    ```

## Deployment

This API is designed for and deployed on Vercel. Every push to the `main` branch will automatically trigger a new production deployment. Ensure that all necessary environment variables are also configured in the Vercel project settings. 