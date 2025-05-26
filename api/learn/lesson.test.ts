// @jest-environment node

import handler from './generate-lesson';

// Need to make jest global to fix linter errors
declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;

// Mock Gemini API to avoid actual API calls during tests
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({
              lesson: {
                title: "The Solar System",
                introduction: "Hoot hoot! Let's explore the amazing world of space together!\\nWe're going to learn about our Solar System and all the incredible planets and objects in it!",
                keyPoints: [
                  "The **Sun** is at the center of our Solar System and provides light and heat to all the planets.",
                  "There are **eight planets** that orbit around the Sun, each with unique characteristics.",
                  "**Earth** is the third planet from the Sun and the only planet we know of that has life.",
                  "The planets are divided into **inner planets** (rocky) and **outer planets** (gas giants).",
                  "Our Solar System also contains **moons**, **asteroids**, and **comets**."
                ],
                keywords: [
                  {
                    term: "orbit",
                    definition: "The path an object takes as it moves around another object in space."
                  },
                  {
                    term: "planet",
                    definition: "A large object that orbits a star and has cleared its orbit of other objects."
                  },
                  {
                    term: "solar system",
                    definition: "The Sun and all the objects that orbit around it, including planets, moons, and asteroids."
                  }
                ],
                quickQuiz: [
                  {
                    question: "What is at the center of our Solar System?",
                    options: ["Earth", "The Sun", "The Moon", "Jupiter"],
                    correctAnswerIndex: 1
                  },
                  {
                    question: "How many planets are in our Solar System?",
                    options: ["Seven", "Eight", "Nine", "Ten"],
                    correctAnswerIndex: 1
                  },
                  {
                    question: "Which planet do we live on?",
                    options: ["Mars", "Venus", "Earth", "Jupiter"],
                    correctAnswerIndex: 2
                  }
                ],
                extendedQuiz: [
                  {
                    question: "What makes Earth special compared to other planets?",
                    options: ["It's the biggest", "It has life", "It's closest to the Sun", "It has rings"],
                    correctAnswerIndex: 1,
                    explanation: "Earth is special because it's the only planet we know of that has life, including plants, animals, and humans!"
                  },
                  {
                    question: "What are the outer planets mostly made of?",
                    options: ["Rock and metal", "Ice only", "Gas and ice", "Water"],
                    correctAnswerIndex: 2,
                    explanation: "The outer planets (Jupiter, Saturn, Uranus, and Neptune) are called gas giants because they're mostly made of gas and ice."
                  }
                ],
                imageSuggestions: [
                  {
                    description: "The Solar System with all planets in order",
                    searchQuery: "solar system planets order diagram",
                    safeSourceExample: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Planets2013.svg/1200px-Planets2013.svg.png"
                  },
                  {
                    description: "The Sun as seen from space",
                    searchQuery: "sun space photograph NASA",
                    safeSourceExample: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg/1200px-The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg"
                  }
                ]
              }
            })
          }),
        },
      };
    }),
    HarmBlockThreshold: {
      BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
    },
    HarmCategory: {
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    },
    Type: {
      OBJECT: 'object',
      ARRAY: 'array',
      STRING: 'string',
      INTEGER: 'integer',
      BOOLEAN: 'boolean',
    },
  };
});

describe('/api/learn/generate-lesson', () => {
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
    expect(jsonData).toHaveProperty('lesson_title');
    expect(jsonData.lesson_title).toBe('The Solar System');
    expect(jsonData).toHaveProperty('grade_level');
    expect(jsonData.grade_level).toBe(3);
    expect(jsonData).toHaveProperty('topic');
    expect(jsonData.topic).toBe('solar system');
    expect(jsonData).toHaveProperty('introduction');
    expect(jsonData.introduction).toHaveProperty('hook');
    expect(jsonData.introduction).toHaveProperty('overview');
    expect(jsonData).toHaveProperty('main_content');
    expect(jsonData.main_content).toBeInstanceOf(Array);
    expect(jsonData.main_content.length).toBeGreaterThan(0);
    expect(jsonData).toHaveProperty('fun_facts');
    expect(jsonData.fun_facts).toBeInstanceOf(Array);
    expect(jsonData).toHaveProperty('interactive_elements');
    expect(jsonData.interactive_elements).toHaveProperty('questions');
    expect(jsonData.interactive_elements).toHaveProperty('activities');
    expect(jsonData).toHaveProperty('conclusion');
    expect(jsonData).toHaveProperty('vocabulary');
    expect(jsonData).toHaveProperty('additional_resources');
    expect(jsonData).toHaveProperty('success');
    expect(jsonData.success).toBe(true);
    // Check for new format data
    expect(jsonData).toHaveProperty('newFormat');
    expect(jsonData.newFormat).toHaveProperty('lesson');
    expect(jsonData.newFormat.lesson).toHaveProperty('title');
    expect(jsonData.newFormat.lesson).toHaveProperty('keyPoints');
    expect(jsonData.newFormat.lesson).toHaveProperty('quickQuiz');
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
    expect(jsonData.grade_level).toBe(5);
    expect(jsonData.topic).toBe('solar system');
  });



  it('handles OPTIONS requests for CORS', async () => {
    const req = { 
      method: 'OPTIONS',
      headers: {},
      setHeader: jest.fn()
    };
    
    let statusCode = 0;
    const res = {
      status(code: number) { statusCode = code; return this; },
      end: jest.fn(),
      setHeader: jest.fn(),
    };

    await handler(req, res);
    
    expect(statusCode).toBe(200);
    expect(res.end).toHaveBeenCalled();
  });
}); 