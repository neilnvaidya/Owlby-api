# SVG Image Generation Integration

## Overview
This document outlines the plan for implementing SVG diagram generation in the Owlby API. This feature will allow the chat endpoint to generate educational diagrams in SVG format using the Gemini AI API.

## Implementation Strategy

### 1. API Endpoint Enhancement
- ✅ Enhance the existing `/api/chat/response` endpoint to support SVG generation
- ✅ Modify the Gemini AI prompting to specifically request diagrams in SVG format
- ✅ Add SVG content to the chat response structure

### 2. SVG Processing Pipeline
- ✅ **Request Analysis**: Detect when a user's question would benefit from a diagram
- ✅ **Prompt Engineering**: Use specific prompts to request SVG-based diagrams
- ✅ **Sanitization**: Implement SVG sanitization to ensure security and compatibility
- ✅ **Validation**: Verify that generated SVGs are well-formed and renderable

### 3. Response Format
✅ The enhanced response format now includes:
```json
{
  "response": "Text response from AI",
  "chatId": "unique-chat-id",
  "diagram": {
    "svg": "<svg>...</svg>",
    "title": "Diagram title",
    "description": "Brief description of what the diagram shows"
  }
}
```

## Technical Requirements

### Gemini API Configuration
- ✅ Use Gemini model version with diagram generation capability
- ✅ Configure proper system prompts to generate educational SVG diagrams
- ✅ Handle fallback scenarios when diagrams cannot be generated

### SVG Sanitization
- ✅ Remove any potentially unsafe elements or attributes
- ✅ Ensure SVG is compatible with React Native SVG rendering
- ✅ Optimize SVG size and complexity for mobile rendering

### SVG Storage Strategy
- 🔄 Initially store SVGs with unique identifiers in file storage (planned for future improvement)
- 🔄 Track usage frequency to identify common diagram needs (planned for future improvement)
- 🔄 Enable retrieval of previously generated SVGs for similar queries (planned for future improvement)

## Implementation Tasks

1. ✅ Research Gemini's SVG generation capabilities and limitations
2. ✅ Enhance system prompts to request educational diagrams when relevant
3. ✅ Add SVG sanitization and validation library to the project
4. ✅ Update response schema to include diagram data
5. 🔄 Create simple storage system for generated SVGs (planned for future improvement)
6. 🔄 Update tests to cover SVG generation scenarios
7. ✅ Document the enhanced API for frontend teams

## Future Enhancements
- SVG similarity detection to prevent redundant diagram generation
- Structured taxonomy of educational concepts linked to SVGs
- Admin tools for SVG quality management and curation
- Dynamic SVG modification for different age groups/contexts

## Integration with Frontend
✅ The mobile app has been updated to:
- Parse the enhanced response format
- Use react-native-svg to render SVGs in chat bubbles
- Handle loading states and fallbacks for SVG rendering

## Timeline
The core SVG generation functionality is now complete as part of Sprint 2.1 (SVG Image Generation Integration). 