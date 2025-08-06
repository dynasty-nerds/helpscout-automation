# System Prompt Improvements

**Type**: Implementation Plan

## Overview
Potential improvements to the Claude AI system prompt for HelpScout integration. System is currently working well at ~$0.035/ticket (~$42/year for 1,200 tickets), but these refinements could improve clarity and consistency.

## User Need
- Reduce contradictions in instructions
- Improve consistency in responses
- Maintain cost efficiency while improving quality

## Implementation Steps

### 1. Fix Greeting Format Contradiction
- **Issue**: Unclear where TWO line breaks should go
- **Current**: Mixed instructions about line breaks after greeting vs after first sentence
- **Fix**: Clarify that two line breaks go after "Hey [Name]," before starting the response

### 2. Consolidate MemberPress Instructions
- **Issue**: MemberPress handling spread across 3 sections (lines 252-285)
- **Fix**: Create single "MEMBERPRESS COMPLETE GUIDE" section with:
  - Data handling
  - Information extraction
  - Long-time member appreciation
  - All in one place for easier maintenance

### 3. Create Clear Documentation Hierarchy
- **Issue**: "Check Fix Changelog FIRST" mentioned 3+ times
- **Fix**: Add at beginning:
  ```
  DOCUMENTATION PRIORITY ORDER:
  1. Fix Changelog (solutions)
  2. Known Issues (active problems)
  3. General Documentation (everything else)
  ```

### 4. Clarify Payment Sync Rules
- **Issue**: Says "ALL payments sync instantly" but Known Issues might contradict
- **Fix**: Add: "ALL payments sync instantly (unless listed in Known Issues document)"

### 5. Clarify Response Length Guidelines
- **Issue**: "< 4 lines" too restrictive for complex issues
- **Fix**: 
  - Simple acknowledgments: < 4 lines
  - Problem-solving responses: As needed for clarity
  - Feature requests/bugs: Brief acknowledgment + notes for agent

### 6. Standardize Date Formatting
- **Issue**: Mixed formats (August 5th vs 08/05/2024)
- **Fix**: Pick one format for all dates:
  - User-facing: "August 5th, 2024"
  - MemberPress info: Same format
  - Consistency throughout

### 7. Create Gateway Name Mapping
- **Issue**: "manual" and cryptic gateway codes
- **Fix**: Add mapping:
  ```
  GATEWAY DISPLAY NAMES:
  - manual → App Store
  - pr2jtc-3b5 → Stripe
  - PayPal → PayPal
  ```

### 8. Add Screenshot Conflict Guidance
- **Issue**: No guidance when screenshots contradict MemberPress
- **Fix**: Add protocol:
  1. Acknowledge screenshot evidence
  2. State what MemberPress shows
  3. Escalate for manual review
  4. Never dismiss customer evidence

### 9. Remove Redundant Fix Changelog Checks
- **Issue**: Multiple "MUST check Fix Changelog" statements
- **Fix**: State once prominently, remove redundant mentions

### 10. Consider Token Optimization
- **Current**: ~$0.035/ticket is excellent
- **Consider**: 
  - Slight token increase for complex issues if needed
  - Response caching for common issues
  - Keep monitoring costs

## Testing Plan
- Review 10 recent tickets for consistency
- Check greeting format application
- Verify date formatting
- Test MemberPress info display
- Monitor response quality

## Monitoring
- Track if consolidated instructions reduce confusion
- Monitor cost per ticket
- Check response consistency
- Measure agent satisfaction with AI suggestions

## Notes
- Current system working very well
- These are refinements, not critical fixes
- Cost efficiency is excellent at $42/year
- Database connection pool (5 connections) adequate for current load