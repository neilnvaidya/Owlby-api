# Learn API Documentation

## Overview
The Learn API provides structured educational lessons on various topics. It returns comprehensive lesson content with key points, keywords, quizzes, and SVG diagrams tailored to specific grade levels.

## Endpoints

### POST /api/learn/lesson
Generates a comprehensive lesson on a specified topic.

#### Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| topic | string | Yes | The topic for the lesson (e.g., "solar system", "fractions") |
| gradeLevel | number | No | The target grade level for the lesson (default: 3) |

#### Example Request
```json
{
  "topic": "solar system",
  "gradeLevel": 3
}
```

#### Response Format
| Field | Type | Description |
|-------|------|-------------|
| topic | string | The topic of the lesson |
| title | string | A brief title for the lesson |
| introduction | string | An engaging introduction paragraph |
| keyPoints | string[] | Array of key concepts/facts about the topic |
| keywords | object[] | Array of important terms with definitions |
| keywords[].term | string | The keyword or term |
| keywords[].definition | string | Simple, grade-appropriate definition |
| quickQuiz | object | Simple quiz questions for self-assessment |
| quickQuiz.questions | object[] | Array of basic multiple-choice questions |
| quickQuiz.questions[].question | string | The question text |
| quickQuiz.questions[].options | string[] | Array of possible answers |
| quickQuiz.questions[].correctAnswerIndex | number | Zero-based index of the correct answer |
| extendedQuiz | object | More challenging quiz questions |
| extendedQuiz.questions | object[] | Array of more advanced questions |
| extendedQuiz.questions[].question | string | The question text |
| extendedQuiz.questions[].options | string[] | Array of possible answers |
| extendedQuiz.questions[].correctAnswerIndex | number | Zero-based index of the correct answer |
| extendedQuiz.questions[].explanation | string | Explanation of why the answer is correct |
| diagram | object \| null | SVG diagram relevant to the lesson |
| diagram.svg | string | The SVG code for the diagram |
| diagram.title | string | The title of the diagram |
| diagram.description | string | A brief description of the diagram |
| gradeLevel | number | The grade level used for the lesson |

#### Example Response
```json
{
  "topic": "solar system",
  "title": "The Solar System",
  "introduction": "The Solar System is our home in space. It includes the Sun and everything that orbits around it.",
  "keyPoints": [
    "The Sun is at the center of our Solar System",
    "Eight planets orbit around the Sun",
    "Planets are different sizes and made of different materials",
    "Earth is the third planet from the Sun"
  ],
  "keywords": [
    {
      "term": "planet",
      "definition": "A large object that orbits a star and has cleared its orbit of other objects."
    },
    {
      "term": "orbit",
      "definition": "The path an object takes as it moves around another object in space."
    }
  ],
  "quickQuiz": {
    "questions": [
      {
        "question": "What is at the center of our Solar System?",
        "options": ["Earth", "The Sun", "Jupiter", "The Moon"],
        "correctAnswerIndex": 1
      }
    ]
  },
  "extendedQuiz": {
    "questions": [
      {
        "question": "Which planet is known as the Red Planet?",
        "options": ["Venus", "Mars", "Jupiter", "Saturn"],
        "correctAnswerIndex": 1,
        "explanation": "Mars appears red because of iron oxide (rust) on its surface."
      }
    ]
  },
  "diagram": {
    "svg": "<svg width=\"400\" height=\"300\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>",
    "title": "The Solar System",
    "description": "A diagram showing the Sun and planets in our solar system."
  },
  "gradeLevel": 3
}
```

## Lesson Customization

### Grade Level Adaptation
The API adapts lesson content based on the provided `gradeLevel` parameter:
- Content complexity and vocabulary are adjusted appropriately
- Explanations include grade-appropriate analogies and examples
- Default is 3rd grade (approximately 8-9 years old)
- Valid range: 1-6 (elementary school levels)

### Lesson Components

#### Key Points
- Each lesson includes 3-5 key points about the topic
- Points are presented in order of importance/relevance
- Language is adjusted to the specified grade level

#### Keywords
- Important terms related to the topic are defined
- Definitions are simple and grade-appropriate
- These can be used for vocabulary building or flashcards

#### Quick Quiz
- Simple multiple-choice questions to test basic understanding
- Typically 3 questions with 4 options each
- Designed for immediate self-assessment after learning

#### Extended Quiz
- More challenging questions that require deeper understanding
- Includes explanations for correct answers
- Can be used for more comprehensive assessment

#### SVG Diagrams
- Educational diagrams relevant to the topic
- Includes a title and description for context
- SVGs are sanitized for safety and optimized for display

## Client Integration

### Recommended Usage
- Use the Chat API to identify educational topics
- When a topic with `learnMoreAvailable: true` is found, offer to generate a lesson
- Pass the detected topic to the Learn API
- Render the structured lesson content in an appropriate UI
- Use the keyword definitions for interactive vocabulary exercises
- Implement the quizzes as interactive assessments 