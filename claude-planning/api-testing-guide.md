# API Testing Guide

## Base URL
Production: `https://helpscout-automation.vercel.app/api`

## Available Endpoints

### 1. Scan and Tag Conversations
**POST** `/api/scan-and-tag`

Scans active conversations, analyzes sentiment, assigns topic tags, and creates notes/drafts.

Query Parameters:
- `dryRun=true` - Test without making changes
- `limit=10` - Limit number of conversations
- `conversationId=123456` - Process specific conversation
- `scanClosed=true` - Scan closed tickets
- `forceReprocess=true` - Force reprocess (only with dryRun + scanClosed)

Example:
```
https://helpscout-automation.vercel.app/api/scan-and-tag?dryRun=true&limit=5
```

### 2. Generate Response Template
**POST** `/api/generate-response`

Generate a customer response template for any issue.

Request Body:
```json
{
  "issueDescription": "Users can't log in after App Store purchase",
  "customerName": "Chad",
  "tone": "friendly",
  "includeApology": true
}
```

Test UI: https://helpscout-automation.vercel.app/test-generate-response.html

### 3. Analyze Tags
**GET** `/api/analyze-tags`

Analyzes all existing HelpScout tags and provides cleanup recommendations.

Example:
```
https://helpscout-automation.vercel.app/api/analyze-tags
```

Returns:
- Tag usage statistics
- Duplicate detection
- Merge recommendations
- Category groupings

### 4. Test Connection
**GET** `/api/test-connection`

Tests HelpScout API connection and permissions.

Example:
```
https://helpscout-automation.vercel.app/api/test-connection
```

### 5. FastDraft Code Lookup
**GET** `/api/fastdraft-code?email=user@example.com`

Looks up FastDraft promotion codes by email.

Example:
```
https://helpscout-automation.vercel.app/api/fastdraft-code?email=john@example.com
```

### 6. Test AI Analysis
**POST** `/api/test-ai`

Test Claude AI analysis without HelpScout integration.

Request Body:
```json
{
  "message": "I'm really upset that my subscription isn't working!",
  "subject": "Billing Issue"
}
```

## Topic Tagging System

The automation system assigns one topic tag per ticket based on the Topic Tagging System document:
https://secure.helpscout.net/docs/6894d315cc94a96f86d43e59/article/6894d33473b0d70353930e9e/

### Tag Categories:
- **Standalone Tags** (Green): Independent categories like `film-room`, `podcast`, `sleeper-mini`
- **Parent Tags** (Blue): Categories with subcategories like `account-login`, `league-sync`
- **Child Tags** (Purple): Specific subcategories like `account-login/payment-sync`, `league-sync/espn`

### Sentiment Tags (Applied Separately):
- `angry-customer` - Anger score ≥ 40
- `high-urgency` - Urgency score ≥ 60
- `spam` - Detected spam

## Testing Workflows

### Test New Ticket Processing
1. Find a ticket ID in HelpScout
2. Run: `/api/scan-and-tag?conversationId=TICKET_ID&dryRun=true`
3. Review the response for correct tagging and suggested response

### Test Bulk Processing
1. Run: `/api/scan-and-tag?dryRun=true&limit=10`
2. Review results for accuracy
3. Remove `dryRun=true` to apply changes

### Test Response Generation
1. Visit: https://helpscout-automation.vercel.app/test-generate-response.html
2. Enter issue description
3. Generate and review response
4. Copy to use as template

## Authentication

All endpoints use environment variables for authentication:
- `HELPSCOUT_APP_ID` - HelpScout OAuth App ID
- `HELPSCOUT_APP_SECRET` - HelpScout OAuth App Secret
- `CLAUDE_API_KEY` - Anthropic Claude API Key
- `MEMBERPRESS_API_KEY` - MemberPress API Key
- `MYSQL_*` - Database credentials for MemberPress data

## Rate Limits

- HelpScout API: 400 requests per minute
- Claude API: Based on your Anthropic plan
- Recommended: Process in batches of 50 or less

## Error Handling

Common errors and solutions:

### 401 Unauthorized
- Check HelpScout OAuth credentials
- Ensure app has proper scopes

### 429 Rate Limited
- Reduce batch size
- Add delays between requests

### 500 Internal Error
- Check Vercel logs
- Verify all environment variables are set

## Monitoring

View logs at:
- Vercel Dashboard: https://vercel.com/dynastynerds/helpscout-automation
- Check function logs for detailed error messages

---

*Last Updated: August 2025*