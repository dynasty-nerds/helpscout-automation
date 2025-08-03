# Phase 1: Core Infrastructure & Angry Customer Detection

**Type**: Implementation Plan

## Overview
Implement the foundation for detecting and prioritizing angry customer tickets in HelpScout using sentiment analysis and API automation.

## Implementation Steps

### 1. Project Setup & Authentication

```bash
# Initialize Node.js project
npm init -y
npm install axios dotenv @helpscout/api luxon
npm install --save-dev typescript @types/node jest @types/jest
```

**Authentication Setup:**
- Use Client Credentials Flow for internal integration
- Store credentials in `.env` file
- Implement token refresh mechanism (tokens expire after 2 days)

### 2. Sentiment Analysis Engine

```typescript
interface SentimentIndicators {
  profanityCount: number;
  capsRatio: number;
  urgencyKeywords: string[];
  refundMentions: number;
  angerScore: number; // 0-100
}
```

**Detection Rules:**
- Profanity: Common curse words list
- Capitalization: >30% caps = high anger
- Keywords: "immediately", "now", "urgent", "refund", "cancel", "unacceptable"
- Composite scoring algorithm

### 3. API Client Implementation

```typescript
class HelpScoutClient {
  private accessToken: string;
  private tokenExpiry: Date;
  
  async authenticate(): Promise<void>
  async getActiveConversations(): Promise<Conversation[]>
  async moveToFolder(conversationId: number, folderId: number): Promise<void>
  async addTag(conversationId: number, tag: string): Promise<void>
}
```

### 4. Conversation Scanner

```typescript
interface ScanResult {
  conversationId: number;
  customerEmail: string;
  subject: string;
  angerScore: number;
  indicators: SentimentIndicators;
  recommendedAction: 'immediate' | 'priority' | 'normal';
}
```

**Scanning Logic:**
1. Fetch all active conversations
2. Analyze each message thread
3. Calculate anger scores
4. Sort by priority
5. Move high-priority to folder

### 5. Folder Management

**Setup Tasks:**
- Check if "Angry Customers" folder exists
- Create folder if missing
- Store folder ID for operations
- Implement conversation moving logic

### 6. Initial Script Structure

```typescript
// index.ts
async function main() {
  const client = new HelpScoutClient();
  await client.authenticate();
  
  const scanner = new ConversationScanner(client);
  const results = await scanner.scanActiveConversations();
  
  const angryCustomers = results.filter(r => r.angerScore > 70);
  
  for (const customer of angryCustomers) {
    await client.moveToFolder(customer.conversationId, ANGRY_FOLDER_ID);
    await client.addTag(customer.conversationId, 'angry-customer');
  }
}
```

## Testing Plan
- Mock API responses for unit tests
- Test sentiment scoring with sample messages
- Validate folder operations
- End-to-end integration test

## Monitoring
- Log API rate limit usage
- Track processing time per conversation
- Record anger score distribution
- Monitor folder movement success rate

## Next Steps
- Set up cron job for regular scanning
- Add webhook listener for real-time processing
- Prepare Teams integration endpoints