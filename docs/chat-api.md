# Chat API Documentation

## Overview
The Chat API provides an interface for interacting with Owlby's educational AI assistant. It returns age-appropriate, educational responses to questions with support for SVG diagrams and the ability to generate full lessons on educational topics.

## Endpoints

### POST /api/chat/response
Sends a message to the AI assistant and returns a response.

#### Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| message | string | Yes | The user's message or question |
| chatId | string | Yes | A unique identifier for the chat session |
| gradeLevel | number | No | The target grade level for the response (default: 3) |

#### Example Request
```json
{
  "message": "What is the solar system?",
  "chatId": "user123-session456",
  "gradeLevel": 3
}
```

#### Response Format
| Field | Type | Description |
|-------|------|-------------|
| response | string | The AI's text response to the user's message |
| chatId | string | The chat session identifier |
| diagram | object \| null | SVG diagram data (if generated) |
| diagram.svg | string | The SVG code for the diagram |
| diagram.title | string | The title of the diagram |
| diagram.description | string | A brief description of the diagram |
| topic | string | The main topic extracted from the conversation |
| gradeLevel | number | The grade level used for the response |
| learnMoreAvailable | boolean | Whether this topic can be expanded into a lesson |

#### Example Response
```json
{
  "response": "The solar system is the collection of the Sun and everything that orbits around it, including planets, moons, asteroids, and comets. There are eight planets in our solar system: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.",
  "chatId": "user123-session456",
  "diagram": {
    "svg": "<svg width=\"400\" height=\"300\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>",
    "title": "The Solar System",
    "description": "A diagram showing the Sun and planets in our solar system."
  },
  "topic": "solar system",
  "gradeLevel": 3,
  "learnMoreAvailable": true
}
```

## Response Customization

### Grade Level Adaptation
The API adapts its responses based on the provided `gradeLevel` parameter:
- Content complexity and vocabulary are adjusted to be appropriate for the specified grade
- Explanations include grade-appropriate analogies and examples
- Default is 3rd grade (approximately 8-9 years old)
- Valid range: 1-6 (elementary school levels)

### Educational Topics
When a message is identified as an educational topic (science, math, history, etc.):
- Response includes 3-5 key points about the topic
- Content is structured with bullet points for clarity
- `learnMoreAvailable` is set to true, indicating that a full lesson can be generated

### SVG Diagrams
For concepts that benefit from visual explanations:
- The API automatically generates an SVG diagram
- Diagrams are designed to be educational and age-appropriate
- Each diagram includes a title and description
- SVGs are sanitized for safety and optimized for mobile display

## Client Integration

### Maintaining Chat Context
The API maintains conversation context within a session:
- Use the same `chatId` for all messages within a conversation
- Generate a new `chatId` when starting a new conversation
- The AI will remember previous messages in the same session

### Learn More Integration
When `learnMoreAvailable` is true:
- Client applications should display a "Learn More" button
- When clicked, this button should call the Learn API endpoint with the detected `topic`
- See the Learn API documentation for details on generating lessons 