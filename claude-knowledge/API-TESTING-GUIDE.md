# HelpScout Automation API Testing Guide

## API Endpoints

### Main Endpoint
`https://helpscout-automation.vercel.app/api/scan-and-tag`

## Available Parameters

### 🧪 Testing Parameters

| Parameter | Values | Description | Example |
|-----------|--------|-------------|---------|
| `dryRun` | `true`/`false` | Test without making changes | `?dryRun=true` |
| `limit` | number | Process only N tickets | `?limit=5` |
| `conversationId` | number | Process a specific conversation only | `?conversationId=3025705076` |
| `scanClosed` | `true`/`false` | Scan closed tickets instead of active | `?scanClosed=true` |
| `forceReprocess` | `true`/`false` | Reprocess tickets with existing notes (only works on closed tickets in dry run) | `?forceReprocess=true` |

## Common Testing Scenarios

### 1. Test AI Sentiment on Active Tickets (Safe)
```
https://helpscout-automation.vercel.app/api/scan-and-tag?dryRun=true&limit=5
```
- Processes 5 active tickets
- No changes made
- Shows what would be tagged

### 2. Test on Closed Tickets with Force Reprocess
```
https://helpscout-automation.vercel.app/api/scan-and-tag?dryRun=true&scanClosed=true&limit=5&forceReprocess=true
```
- Tests on closed tickets
- Reprocesses even if they have AI notes
- Safe for testing AI sentiment

### 3. Test Specific Conversation (Safe)
```
https://helpscout-automation.vercel.app/api/scan-and-tag?conversationId=3025705076&dryRun=true
```
- Tests a single specific ticket
- Get the ID from HelpScout URL (e.g., secure.helpscout.net/conversation/3025705076/...)
- Perfect for testing new tickets or debugging

### 4. Process Specific Conversation (Production)
```
https://helpscout-automation.vercel.app/api/scan-and-tag?conversationId=3025705076
```
- Actually processes just that one ticket
- Adds tags and notes to that specific conversation
- Good for handling individual urgent tickets

### 5. Small Production Run
```
https://helpscout-automation.vercel.app/api/scan-and-tag?limit=10
```
- Actually processes 10 tickets
- Adds tags and notes
- Good for monitoring initial results

### 6. Full Production Run
```
https://helpscout-automation.vercel.app/api/scan-and-tag
```
- Processes ALL active/pending tickets
- Full automation

## What Gets Logged

### In Vercel Logs You'll See:
- 🤖 AI sentiment scores vs keyword scores
- 📊 Detailed comparison and differences
- 🎯 AI triggers detected
- 💡 AI reasoning for scores
- Claude API token usage

### Example Log Output:
```
🤖 === AI SENTIMENT ANALYSIS COMPARISON ===
📊 AI Sentiment Scores    - Anger: 0/100, Urgency: 20/100
🔍 Keyword Scores        - Anger: 0/100, Urgency: 65/100
📈 Difference            - Anger: 0, Urgency: -45
🎯 AI Triggers:
   - Anger: none
   - Urgency: nothing happens
💡 AI Reasoning: Customer is expressing excitement ('stoked')...
```

## System Features

### AI Sentiment Analysis
- **Anger threshold**: ≥ 40 → adds "angry-customer" tag
- **Urgency threshold**: ≥ 60 → adds "high-urgency" tag
- **Spam detection**: Automatic spam tagging

### Processing Rules
- Skips tickets with existing AI notes (unless `forceReprocess=true`)
- Preserves ticket status (pending stays pending)
- Draft replies set to "closed" status
- Maintains existing assignee

### Safety Features
- `forceReprocess` only works on closed tickets in dry run
- Prioritizes tickets without AI notes when using `limit`
- Clear logging of what mode is active

## Tips for Testing

1. **Always start with dry run**: Add `?dryRun=true` first
2. **Test on closed tickets**: Use `?scanClosed=true` for safe testing
3. **Use limits**: Start with `?limit=5` before full runs
4. **Check logs**: Vercel logs show detailed AI analysis
5. **Monitor costs**: Each ticket costs ~$0.01 for AI analysis + response

### Using conversationId Parameter

The `conversationId` parameter is perfect for:
- **Testing specific problematic tickets**: When you need to debug why a ticket was processed a certain way
- **Processing urgent tickets immediately**: Don't wait for the full scan
- **Testing with known examples**: Create a test ticket and process just that one
- **Re-running on specific conversations**: Combine with `forceReprocess=true` to re-analyze

To find a conversation ID:
1. Open the conversation in HelpScout
2. Look at the URL: `https://secure.helpscout.net/conversation/3025705076/...`
3. The number after `/conversation/` is the ID (e.g., `3025705076`)

Example combinations:
- Test one ticket: `?conversationId=3025705076&dryRun=true`
- Force re-analyze closed ticket: `?conversationId=3025705076&scanClosed=true&forceReprocess=true&dryRun=true`
- Process one urgent ticket now: `?conversationId=3025705076`

## System Prompt Location

The AI system prompt is in:
```
/lib/claude-client.ts
```

Starting at line 49, it includes:
- Response generation instructions
- Sentiment analysis guidelines
- Anger/urgency scoring criteria
- NERD-RETRO coupon code policy