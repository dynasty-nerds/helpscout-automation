# Troubleshooting: HelpScout Docs API

**Type**: Documentation

## Overview
Investigation into why only internal documentation URLs (internal://gaps, internal://learnings) are showing in the Referenced Documentation section of AI notes.

## Issue Description
- AI notes are showing "internal://gaps" and "internal://learnings" in the Referenced Documentation section
- Actual HelpScout documentation articles are not appearing
- This makes the AI responses less helpful for agents

## Root Causes Identified

### 1. Internal Docs Added to Context
The code adds internal learning files to the context docs array that gets passed to Claude:
```typescript
const contextDocs = [
  ...relevantDocs,
  {
    title: 'Agent Learning Insights',
    content: learnings,
    url: 'internal://learnings'
  },
  {
    title: 'Known Documentation Gaps',
    content: gaps,
    url: 'internal://gaps'
  }
]
```

### 2. Potential API Configuration Issues
- The HelpScout Docs API requires `HELPSCOUT_DOCS_API_KEY` to be set
- If not configured, no articles will be fetched
- The API might be returning empty results

## Solutions Implemented

### 1. Filter Internal URLs from Display
Modified the note formatting to exclude internal:// URLs:
```typescript
// Skip internal URLs
if (url && url.startsWith('internal://')) {
  return
}
```

### 2. Enhanced Logging
Added detailed logging to help diagnose:
- Total cached articles available
- Relevant docs found with names and URLs
- Key terms used for searching
- Top scoring articles with scores

### 3. Test Endpoint
Created `/api/test-docs` endpoint to verify:
- Collections are being fetched
- Articles are being cached
- Search is working properly

## Testing the Fix

### 1. Check Docs API Configuration
```bash
# Test the docs API endpoint
curl http://localhost:3000/api/test-docs

# Test with a specific message
curl "http://localhost:3000/api/test-docs?message=refund"
```

### 2. Verify Environment Variables
Ensure `.env` file contains:
```
HELPSCOUT_DOCS_API_KEY=your_actual_api_key
```

### 3. Monitor Logs
When running scan-and-tag, look for:
- "Total cached articles available: X"
- "Found X relevant docs for message"
- "Top scoring articles" with actual article names

## Remaining Considerations

### 1. API Key Validity
- Verify the HELPSCOUT_DOCS_API_KEY is valid and has proper permissions
- Check if the API key has access to the correct docs site

### 2. Article Content
- Some articles might be empty or missing text content
- The search algorithm relies on article name and text fields

### 3. Search Algorithm Improvements
Could enhance the search to:
- Use more sophisticated text matching
- Consider synonyms and related terms
- Boost recent or frequently referenced articles

## Notes
- Internal docs (learnings and gaps) are still passed to Claude for context
- They're just filtered out from the display in the note
- This allows Claude to use the learning insights without confusing agents with internal URLs