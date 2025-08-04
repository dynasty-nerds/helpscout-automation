# Deployment and Authentication Setup Plan

**Type**: Implementation Plan

## Overview
Plan for setting up HelpScout API authentication, choosing deployment infrastructure, and implementing secure credential management for the angry customer detection system.

## Authentication Setup

### 1. HelpScout OAuth Application
**Steps to create:**
1. Log into HelpScout account as admin
2. Navigate to: Account Settings → Apps → OAuth2 Applications
3. Create new application with:
   - Name: "DynastyNerds Support Automation"
   - Redirect URL: (not needed for Client Credentials flow)
   - Scopes needed:
     - `conversations.read`
     - `conversations.write`
     - `folders.read`
     - `folders.write`
     - `tags.write`
     - `webhooks.write` (for future real-time processing)

**What you'll get:**
- Application ID
- Application Secret
- These expire every 2 days - need automatic refresh

### 2. Deployment Options Analysis

#### Option A: AWS Lambda (Recommended)
**Pros:**
- Serverless, pay-per-execution
- Built-in scheduling with EventBridge
- Easy secrets management with AWS Secrets Manager
- Scales automatically
- Low maintenance

**Cons:**
- 15-minute execution limit
- Cold start latency
- AWS learning curve

**Architecture:**
```
EventBridge (cron) → Lambda Function → HelpScout API
                           ↓
                    Teams Webhook
```

#### Option B: VPS with Cron
**Pros:**
- Full control over environment
- No execution time limits
- Can run continuously

**Cons:**
- Manual server management
- Fixed monthly cost
- Need to handle scaling

#### Option C: GitHub Actions
**Pros:**
- Free for public repos (2000 min/month private)
- Built-in secrets management
- Easy to set up
- Version controlled

**Cons:**
- 6-hour job limit
- Not ideal for real-time webhooks

### 3. Secrets Management Strategy

**Development:**
- Local `.env` file (git-ignored)
- `.env.example` with dummy values

**Production (AWS):**
```javascript
// AWS Secrets Manager
const secrets = {
  HELPSCOUT_APP_ID: "stored-in-secrets-manager",
  HELPSCOUT_APP_SECRET: "stored-in-secrets-manager",
  TEAMS_WEBHOOK_URL: "stored-in-secrets-manager",
  OPENAI_API_KEY: "stored-in-secrets-manager"
}
```

**Production (GitHub Actions):**
- Repository secrets
- Environment-specific secrets

### 4. Scheduling Strategy

**Initial Phase (Batch Processing):**
- Run every 15 minutes during business hours
- Less frequent overnight/weekends
- Example schedule: `*/15 9-17 * * MON-FRI`

**Future Phase (Real-time):**
- HelpScout webhooks → API Gateway → Lambda
- Instant processing of new conversations

### 5. Environment Setup

```bash
# Development
helpscout-automation/
├── .env.local          # Local dev credentials
├── .env.staging        # Staging environment
├── .env.example        # Template for team
├── src/
├── tests/
└── deploy/
    ├── lambda/         # AWS Lambda configs
    └── github/         # GitHub Actions workflows
```

### 6. API Rate Limits & Considerations

**HelpScout Limits:**
- 400 requests per minute
- Plan for batching and caching
- Implement exponential backoff

**Cost Estimates:**
- AWS Lambda: ~$0 for low volume
- API calls: Free (included in HelpScout plan)
- Teams webhooks: Free
- OpenAI API: ~$0.01-0.05 per ticket

### 7. Security Checklist

- [ ] Never commit credentials
- [ ] Use least-privilege API scopes
- [ ] Rotate tokens regularly
- [ ] Encrypt data in transit
- [ ] Log access but not secrets
- [ ] Set up alerting for failures

## Next Steps

1. **Immediate Actions:**
   - Create HelpScout OAuth application
   - Choose deployment platform
   - Set up AWS account (if using Lambda)

2. **Development Setup:**
   - Create local development environment
   - Test API authentication
   - Verify rate limits

3. **Infrastructure:**
   - Set up chosen deployment platform
   - Configure secrets management
   - Create CI/CD pipeline

## Decision Required

Which deployment option do you prefer?
- **AWS Lambda** (recommended for scalability)
- **VPS** (if you have existing infrastructure)
- **GitHub Actions** (quick start, good for POC)

Once decided, I can create specific implementation guides for your chosen platform.