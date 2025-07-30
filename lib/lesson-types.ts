/**
 * Types for the Learn API endpoints
 */

/**
 * Request body for the lesson endpoint
 */
export interface LessonRequestBody {
  topic: string;
  gradeLevel?: number; // Optional, defaults to 3
}

/**
 * Definition of a keyword with its term and definition
 */
export interface KeywordDefinition {
  term: string;
  definition: string;
}

/**
 * Basic quiz question structure
 */
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

/**
 * Extended quiz question with explanation
 */
export interface ExtendedQuizQuestion extends QuizQuestion {
  explanation: string;
}

/**
 * SVG diagram data structure
 */
export interface DiagramData {
  svg: string;
  title: string;
  description: string;
}

/**
 * Complete lesson structure
 */
export interface Lesson {
  topic: string;
  title: string;
  introduction: string;
  keyPoints: string[];
  keywords: KeywordDefinition[];
  challengeQuiz: {
    questions: ExtendedQuizQuestion[];
  };
  diagram: DiagramData | null;
  gradeLevel: number;
} 