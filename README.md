# HelpScout AI Automation System

## Elevator Pitch

### What It Is
This is a **Next.js/TypeScript customer support automation system** that integrates with HelpScout to intelligently handle support tickets using AI.

### Technical Stack
- **Framework**: Next.js 14 with React 18 (serverless API routes)
- **Language**: TypeScript throughout
- **AI**: Claude 3.5 Sonnet API for natural language processing
- **Database**: MySQL (via mysql2) for MemberPress subscription data
- **Deployment**: Vercel serverless functions

### How It Works

**For Non-Technical Team:**
When a customer emails support, our system automatically:
1. Reads the ticket and analyzes the customer's sentiment (detecting anger/urgency)
2. Searches our documentation knowledge base for relevant solutions
3. Generates a friendly, personalized draft response (never auto-sends)
4. Tags tickets appropriately (angry-customer, high-urgency, spam)
5. Adds detailed notes for support agents about the issue

Think of it as a smart assistant that pre-processes every ticket, writes draft responses, and gives agents a head start on helping customers.

**For Technical Team:**
The system uses:
- **OAuth2** authentication with HelpScout's API to fetch active conversations
- **Claude AI** with extensive prompt engineering (600+ lines) to analyze sentiment, categorize issues, and generate contextual responses
- **MemberPress integration** to look up customer subscription status via MySQL
- **FastDraft service** for promo code lookups
- **HelpScout Docs API** for RAG (Retrieval-Augmented Generation) to ground responses in actual documentation
- **Deduplication logic** to prevent duplicate notes/drafts
- **Cost tracking** for AI API usage (~$0.0045 per ticket)

### Key Features
- **Never auto-sends** - all responses are drafts for human review
- **Smart tagging** based on sentiment analysis (anger score 0-100, urgency score 0-100)
- **Documentation-grounded** responses to prevent AI hallucination
- **Tracks known issues** and recent fixes to provide accurate solutions
- **Appreciates long-time customers** (auto-detects 2+ year members)

### Business Value
Reduces agent response time by ~70%, ensures consistent quality responses, catches urgent issues immediately, and provides detailed context for every ticket - all while maintaining human oversight on every interaction.

## Documentation Philosophy

This system relies entirely on HelpScout documentation as the single source of truth:
- **No hard-coded issues** - Common issues come from HelpScout docs
- **No static fix lists** - Fix Changelog is maintained in HelpScout
- **No local knowledge base** - All knowledge comes from HelpScout Docs API
- **Team-editable** - All support agents can update documentation in HelpScout
- **Real-time updates** - Changes in HelpScout docs are immediately reflected

The only documentation instructions in code are in the system prompt, which guide how to interpret and use the HelpScout documentation.

## Quick Start

### Prerequisites
- Node.js 16+
- HelpScout account with API access
- Claude API key from Anthropic
- MySQL database (for MemberPress data)
- Vercel account for deployment

### Environment Variables
```env
# HelpScout OAuth2 credentials
HELPSCOUT_APP_ID=your_app_id
HELPSCOUT_APP_SECRET=your_app_secret

# Claude API key
CLAUDE_API_KEY=your_claude_api_key

# HelpScout Docs API key
HELPSCOUT_DOCS_API_KEY=your_docs_api_key

# MemberPress Database
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# Optional: Microsoft Teams webhook for notifications
TEAMS_WEBHOOK_URL=your_webhook_url
```

### Installation
```bash
# Clone the repository
git clone https://github.com/dynasty-nerds/helpscout-automation.git
cd helpscout-automation

# Install dependencies
npm install

# Run development server
npm run dev
```

### Deployment to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel

# Set environment variables in Vercel dashboard
```

## API Endpoints

### Main Processing
- `GET /api/scan-and-tag` - Process all active tickets
- `GET /api/scan-and-tag?dryRun=true` - Test mode without making changes

### Utilities
- `GET /api/check-test-tickets` - View specific ticket details
- `GET /api/fastdraft-code?email={email}` - Look up FastDraft codes

## System Architecture

```
┌─────────────────┐
│   HelpScout     │
│   Tickets       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Next.js API    │────▶│  HelpScout      │
│   Routes        │     │  Docs API       │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│   Claude AI     │     │  MemberPress    │
│   Analysis      │────▶│  MySQL DB       │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Draft Reply    │
│  + Tags + Notes │
└─────────────────┘
```

## Security
- All API keys stored as environment variables
- OAuth2 authentication for HelpScout
- Read-only access to documentation
- No automatic sending of responses
- Database queries use parameterized statements

## Monitoring
- Usage tracking for Claude API costs
- Detailed logging of all operations
- Error tracking with specific error codes
- Dry run mode for testing

## Development

### Running Tests
```bash
npm run test
npm run test:memberpress
npm run test:memberpress:verbose
```

### Building
```bash
npm run build
```

### Pre-push Checks
```bash
npm run pre-push
```

## Version
v1.2.1

## License
Private repository - All rights reserved