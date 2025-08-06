# MemberPress Integration Testing Guide

## Overview
This guide provides step-by-step instructions for testing every component of the MemberPress integration with verbose logging.

## Test Scripts Available

### 1. Basic MemberPress Test
```bash
npm run test:memberpress
```
- Quick connectivity test
- Basic function verification

### 2. Verbose MemberPress Test (Recommended)
```bash
npm run test:memberpress:verbose
```
- Detailed logging with color-coded output
- Tests every function with multiple scenarios
- Shows exactly what data is retrieved
- Includes AI integration simulation

### 3. API Endpoint Test
```bash
npm run test:api:memberpress
```
- Tests the full integration through the API
- Shows mock scenarios
- Can test with real conversation ID:
```bash
TEST_CONVERSATION_ID=12345 npm run test:api:memberpress
```

## Step-by-Step Testing Process

### Step 1: Environment Setup
1. Ensure your `.env` file has the correct MemberPress credentials:
```env
MEMBERPRESS_DB_HOST=165.227.87.17
MEMBERPRESS_DB_PORT=3306
MEMBERPRESS_DB_NAME=dynastyn_Dynastynerds
MEMBERPRESS_DB_USER=nick_readonly
MEMBERPRESS_DB_PASSWORD=your_actual_password
```

2. Verify environment variables are loaded:
```bash
npm run test:api:memberpress
```
Look for the "Environment Check" section.

### Step 2: Database Connectivity
Run the verbose test to check database connection:
```bash
npm run test:memberpress:verbose
```

You should see:
- ✅ Database connection successful!
- Connection details (password hidden)
- Test query results

### Step 3: Test with Real Customer Email
Edit `scripts/test-memberpress-verbose.ts` and add a real customer email:
```typescript
const testEmails = [
  'test@example.com',
  'real-customer@email.com', // Add real email here
]
```

Run the test again to see:
- User lookup results
- Active subscription status
- Transaction history
- Full context generation

### Step 4: Test AI Integration
The verbose test includes AI integration simulation showing:
- Which keywords trigger MemberPress lookups
- Expected categorization for different messages
- Sample conversation context sent to Claude

### Step 5: Test with Real Help Scout Conversation

1. Find a conversation ID in Help Scout where a customer mentions subscription issues

2. Run the API test with that conversation:
```bash
TEST_CONVERSATION_ID=your_conversation_id npm run test:api:memberpress
```

3. Use dry run mode to see what would happen:
```bash
curl "http://localhost:3000/api/scan-and-tag?conversationId=12345&dryRun=true"
```

### Step 6: Monitor Logs
When testing, watch for these key log messages:

#### Successful MemberPress Lookup:
```
Fetching MemberPress data for customer@email.com
MemberPress data retrieved: {
  "userFound": true,
  "hasActiveSubscription": true,
  ...
}
```

#### User Not Found:
```
MemberPress data retrieved: {
  "userFound": false,
  "lookupEmail": "customer@email.com",
  "message": "No user found with this email"
}
```

#### AI Response Generation:
```
Claude returned issueCategory: "MemberPress Access Issue"
```

## Testing Scenarios

### 1. Access Issue with Active Subscription
- Customer message: "I can't access premium features"
- Expected: AI confirms active subscription with expiry date

### 2. Access Issue with No User
- Customer message: "I paid but can't access"
- Expected: AI suggests checking different email

### 3. Billing Query
- Customer message: "How much am I paying?"
- Expected: AI shows transaction history with amounts

### 4. App Store Cancellation
- Customer with manual gateway
- Expected: AI directs to App Store settings

### 5. Web Cancellation
- Customer with Stripe gateway
- Expected: AI offers to process cancellation

## Troubleshooting

### Database Connection Fails
- Check firewall/network access
- Verify credentials in .env
- Test with MySQL client directly

### No MemberPress Data in Response
- Check if keywords are detected
- Verify customer email exists in Help Scout
- Look for error logs in console

### AI Not Using MemberPress Data
- Ensure data is added to conversation history
- Check Claude prompt includes MemberPress instructions
- Verify issueCategory matches MemberPress categories

## Production Testing

1. Deploy to staging environment
2. Set environment variables in Vercel/hosting
3. Test with real conversation IDs
4. Monitor logs for errors
5. Verify AI responses include account details

## Success Indicators

✅ Database connects successfully
✅ User lookups return correct data
✅ Active subscriptions show expiry dates
✅ Transaction history includes amounts
✅ AI says "I've checked your account"
✅ Gateway-specific routing works
✅ "User not found" handled gracefully

## Next Steps

After successful testing:
1. Test with multiple real customer emails
2. Process a few dry-run conversations
3. Enable for specific conversations first
4. Monitor AI response quality
5. Gradually roll out to all conversations