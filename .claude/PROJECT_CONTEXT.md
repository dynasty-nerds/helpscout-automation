# HelpScout Automation Project Context

## Project Overview
This is a HelpScout customer support automation system that uses Claude AI to analyze tickets, generate draft responses, and tag conversations based on sentiment analysis.

## Key Documentation References

### API Documentation
When working with HelpScout APIs, refer to:
- **Internal Reference**: `/claude-knowledge/HELPSCOUT-API-REFERENCE.md`
  - Contains direct links to HelpScout API documentation
  - Lists all endpoints we use
  - Includes field definitions for Conversation and Article objects
  - Has authentication details and rate limits

### HelpScout API Resources
- **Docs API**: https://developer.helpscout.com/docs-api/
- **Mailbox API**: https://developer.helpscout.com/mailbox-api/

## Important Document IDs
These unpublished documents are fetched explicitly on every scan:
- **Fix Changelog**: `68919485bb013911a3b209ac`
- **Known Issues**: `68919c52816719208b5a1a93`

## Project Structure
```
/lib/
  claude-client.ts       # Claude AI integration (600+ line prompt)
  helpscout-client.ts    # Mailbox API (conversations, tags, drafts)
  helpscout-docs.ts      # Docs API (fetching documentation)
  
/pages/api/
  scan-and-tag.ts        # Main processing endpoint
  
/src/services/
  memberPressService.ts  # MySQL subscription lookups
  fastDraftService.ts    # Promo code lookups
```

## Core Principles
1. **Never hard-code documentation** - All knowledge comes from HelpScout Docs API
2. **Never auto-send** - Only create draft replies for human review
3. **Always fetch latest** - Pull Fix Changelog and Known Issues on every scan
4. **Documentation is source of truth** - Team updates HelpScout docs, not code

## When Making Changes
- Check `/claude-knowledge/HELPSCOUT-API-REFERENCE.md` for API field definitions
- Verify OAuth2 token handling in `helpscout-client.ts`
- Test with `?dryRun=true` parameter before live changes
- Remember that system prompt in `claude-client.ts` only contains instructions on HOW to use docs, not the docs themselves

## Environment Variables Required
- `HELPSCOUT_APP_ID` and `HELPSCOUT_APP_SECRET` (OAuth2)
- `HELPSCOUT_DOCS_API_KEY` (Docs API)
- `CLAUDE_API_KEY` (Claude AI)
- Database credentials for MemberPress

## Testing Commands
```bash
npm run build              # Verify TypeScript compilation
npm run test:memberpress   # Test database connection
npm run pre-push           # Run all pre-deployment checks
```