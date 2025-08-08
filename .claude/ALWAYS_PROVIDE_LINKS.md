# ALWAYS PROVIDE CLICKABLE LINKS

## Project URLs

### Production (Vercel)
- Main App: https://helpscout-automation.vercel.app
- Generate Response Test: https://helpscout-automation.vercel.app/test-generate-response.html
- API Base: https://helpscout-automation.vercel.app/api

### Common API Endpoints
- Scan and Tag: https://helpscout-automation.vercel.app/api/scan-and-tag
- Generate Response: https://helpscout-automation.vercel.app/api/generate-response
- Analyze Tags: https://helpscout-automation.vercel.app/api/analyze-tags
- Test Connection: https://helpscout-automation.vercel.app/api/test-connection

### Local Development
- Main App: http://localhost:3000
- Generate Response Test: http://localhost:3000/test-generate-response.html
- API Base: http://localhost:3000/api

## IMPORTANT RULES

1. **ALWAYS provide the full clickable URL** when user asks to test something
2. **Default to production URLs** (Vercel) unless user specifically mentions local
3. **Include both the URL and what it does** in the response
4. **For API endpoints, provide the full URL** not just the path

## Examples

Bad: "You can test it at /test-generate-response.html"
Good: "Test it here: https://helpscout-automation.vercel.app/test-generate-response.html"

Bad: "Use the generate-response endpoint"
Good: "Use this endpoint: https://helpscout-automation.vercel.app/api/generate-response"

---
*This file ensures Claude always provides clickable links for the HelpScout automation project*