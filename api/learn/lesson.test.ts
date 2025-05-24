// @jest-environment node

import handler from './lesson';

// Need to make jest global to fix linter errors
declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;

// Mock Gemini API to avoid actual API calls during tests
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockImplementation(() => {
          return {
            generateContent: jest.fn().mockResolvedValue({
              response: {
                text: jest.fn().mockResolvedValue(`
                  <LESSON_JSON>
                  {
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
                    }
                  }
                  </LESSON_JSON>
                  <SVG_DIAGRAM>
                  <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="200" cy="100" r="50" fill="yellow" />
                    <circle cx="300" cy="100" r="20" fill="blue" />
                  </svg>
                  </SVG_DIAGRAM>
                  <SVG_TITLE>The Solar System</SVG_TITLE>
                  <SVG_DESCRIPTION>A simple diagram of the Sun and Earth.</SVG_DESCRIPTION>
                `)
              }
            })
          };
        })
      };
    })
  };
});

describe('/api/learn/lesson', () => {
  it('should return 405 for non-POST requests', async () => {
    const req = { 
      method: 'GET',
      headers: {},
      setHeader: jest.fn()
    };
    
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
      setHeader: jest.fn(),
      end: jest.fn()
    };

    await handler(req, res);
    
    expect(statusCode).toBe(405);
    expect(jsonData).toHaveProperty('error');
  });

  it('should return 400 if topic is missing', async () => {
    const req = { 
      method: 'POST',
      body: {
        gradeLevel: 3
      },
      headers: {},
      setHeader: jest.fn()
    };
    
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
      setHeader: jest.fn(),
      end: jest.fn()
    };

    await handler(req, res);
    
    expect(statusCode).toBe(400);
    expect(jsonData).toHaveProperty('error');
  });

  it('should return a lesson for a valid topic', async () => {
    const req = { 
      method: 'POST',
      body: {
        topic: 'solar system',
        gradeLevel: 3
      },
      headers: {},
      setHeader: jest.fn()
    };
    
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
      setHeader: jest.fn(),
      end: jest.fn()
    };

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(jsonData).toHaveProperty('title');
    expect(jsonData.title).toBe('The Solar System');
    expect(jsonData).toHaveProperty('keyPoints');
    expect(jsonData.keyPoints.length).toBeGreaterThan(0);
    expect(jsonData).toHaveProperty('diagram');
    expect(jsonData.diagram).toBeTruthy();
    expect(jsonData).toHaveProperty('quickQuiz');
    expect(jsonData.quickQuiz.questions.length).toBeGreaterThan(0);
    expect(jsonData).toHaveProperty('extendedQuiz');
    expect(jsonData.extendedQuiz.questions.length).toBeGreaterThan(0);
  });

  it('should use the provided grade level', async () => {
    const req = { 
      method: 'POST',
      body: {
        topic: 'solar system',
        gradeLevel: 5
      },
      headers: {},
      setHeader: jest.fn()
    };
    
    let statusCode = 0;
    let jsonData: any = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonData = data; return this; },
      setHeader: jest.fn(),
      end: jest.fn()
    };

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(jsonData).toHaveProperty('gradeLevel');
    expect(jsonData.gradeLevel).toBe(5);
  });
}); 