# User Profile API Documentation

This document outlines the API endpoints for managing user profiles in the Owlby platform.

## Endpoints

### GET /api/profile

Retrieves the user profile information. If the user doesn't exist in the database yet, a new profile is created.

#### Authentication

Requires a valid Auth0 access token in the Authorization header.

```
Authorization: Bearer <access_token>
```

#### Response

**Success (200 OK)**

```json
{
  "user_id": "auth0|123456789",
  "name": "John Doe",
  "email": "john@example.com",
  "picture": "https://example.com/avatar.jpg",
  "grade_level": 3,
  "interests": ["math", "science", "space"],
  "achievements": ["first_login", "completed_lesson"],
  "parent_email": "parent@example.com"
}
```

**Error (401 Unauthorized)**

```json
{
  "error": "Missing or invalid token"
}
```

### POST /api/profile

Updates the user profile information.

#### Authentication

Requires a valid Auth0 access token in the Authorization header.

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "name": "Updated Name",
  "grade_level": 4,
  "interests": ["coding", "history", "art"],
  "parent_email": "new_parent@example.com"
}
```

All fields are optional. Only the provided fields will be updated.

#### Response

**Success (200 OK)**

```json
{
  "user_id": "auth0|123456789",
  "name": "Updated Name",
  "email": "john@example.com",
  "picture": "https://example.com/avatar.jpg",
  "grade_level": 4,
  "interests": ["coding", "history", "art"],
  "achievements": ["first_login", "completed_lesson"],
  "parent_email": "new_parent@example.com"
}
```

**Error (401 Unauthorized)**

```json
{
  "error": "Authentication failed"
}
```

**Error (500 Internal Server Error)**

```json
{
  "error": "Failed to update profile"
}
```

## Data Validation

- `name`: String, maximum 100 characters
- `parent_email`: String, maximum 255 characters, should be a valid email format
- `grade_level`: Number, between 0 and 12 inclusive
- `interests`: Array of strings, maximum 20 interests

## Implementation Details

The profile endpoint connects to a Supabase database to store and retrieve user information. The user's Auth0 ID is used as the primary identifier to link the profiles.

When a user first accesses the platform, a basic profile is created automatically using information from their Auth0 profile. This can later be enhanced through the update endpoint.

## Error Handling

- If the token is missing or invalid, a 401 error is returned
- If the token is valid but the requested method is not supported, a 405 error is returned
- If there's an error updating the profile, a 500 error is returned
- If there's an error retrieving the profile but the Auth0 token is valid, the endpoint will fall back to using the information from the Auth0 token 