/**
 * Shared config for run-all-timing.js and the gemini-*-test.js helpers.
 * Change API key, model, and injections here; all scripts use these values.
 */

export const API_KEY = "AIzaSyD825Tr_qVidmUl2f2d4i3lWoY7lHiA4tY";
export const MODEL = "gemini-3.1-flash-lite-preview";

export const GRADE_LEVEL = 3;
export const CHAT_USER_PROMPT = "What are rainbows?";
export const CHAT_RECENT_CONTEXT = "User: What are rainbows?";

export const LESSON_TOPIC = "The science of light and color";
export const LESSON_OPTIONAL_TAGS = ["light", "color", "rainbows", "refraction"];

export const STORY_PROMPT = "a prism catching sunlight";
export const STORY_OPTIONAL_TAGS = ["light", "prism", "rainbow", "science"];
