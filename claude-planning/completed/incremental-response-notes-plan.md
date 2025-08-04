# Incremental Response Notes System

**Type**: Implementation Plan

## Overview
Track sentiment changes in ongoing conversations and only create new notes/responses when customer anger or urgency escalates, preventing unnecessary duplicate notes for back-and-forth conversations.

## User Need
- Currently creates notes for every scan, even if nothing has changed
- Wastes API credits on unchanged conversations
- Creates clutter with duplicate notes
- Need to detect when customer frustration is increasing

## Core Logic

### When to Create New Notes/Responses
1. **First customer message** → Always create initial note + response
2. **New customer reply** → Analyze sentiment change:
   - If anger increased by 20+ points → Create new note + response
   - If urgency increased by 20+ points → Create new note + response  
   - If changed to spam → Create spam note (no response)
   - If scores decreased or stayed similar → Skip

### Sentiment Comparison Rules
```
Previous: Anger 20, Urgency 30
Current: Anger 25, Urgency 35
Result: Skip (increases < 20 points)

Previous: Anger 20, Urgency 30
Current: Anger 45, Urgency 35
Result: Create new note (anger +25)

Previous: Anger 60, Urgency 70
Current: Anger 65, Urgency 90
Result: Create new note (urgency +20)
```

## Implementation Steps

### 1. Track Previous Sentiment in Notes
Store sentiment scores in each note for comparison:
```
📝 Technical issue reported
💬 STANDARD (Urgency: 20/100, Anger: 10/100)
[SENTIMENT_DATA: U20_A10]
```

### 2. Parse Previous Sentiment
```typescript
function getPreviousSentiment(notes: Thread[]): {anger: number, urgency: number} | null {
  // Find most recent AI note
  const aiNotes = notes.filter(note => 
    note.body?.includes('[SENTIMENT_DATA:')
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  
  if (aiNotes.length === 0) return null
  
  // Extract scores from note
  const match = aiNotes[0].body.match(/\[SENTIMENT_DATA: U(\d+)_A(\d+)\]/)
  if (!match) return null
  
  return {
    urgency: parseInt(match[1]),
    anger: parseInt(match[2])
  }
}
```

### 3. Decision Logic
```typescript
function shouldCreateNewNote(
  previousSentiment: {anger: number, urgency: number} | null,
  currentSentiment: {anger: number, urgency: number},
  hasNewCustomerReply: boolean
): boolean {
  // Always create note for first analysis
  if (!previousSentiment) return true
  
  // No new customer activity
  if (!hasNewCustomerReply) return false
  
  // Check for significant increases
  const angerIncrease = currentSentiment.anger - previousSentiment.anger
  const urgencyIncrease = currentSentiment.urgency - previousSentiment.urgency
  
  // Thresholds for new note
  const SIGNIFICANT_INCREASE = 20
  const CRITICAL_THRESHOLD = 60 // Always note if crossing into high range
  
  return (
    angerIncrease >= SIGNIFICANT_INCREASE ||
    urgencyIncrease >= SIGNIFICANT_INCREASE ||
    (previousSentiment.anger < CRITICAL_THRESHOLD && currentSentiment.anger >= CRITICAL_THRESHOLD) ||
    (previousSentiment.urgency < CRITICAL_THRESHOLD && currentSentiment.urgency >= CRITICAL_THRESHOLD)
  )
}
```

### 4. Detect New Customer Activity
```typescript
function hasNewCustomerReply(conversation: Conversation, lastAINoteDate: Date): boolean {
  const customerThreads = conversation.threads.filter(
    thread => thread.type === 'customer' && new Date(thread.createdAt) > lastAINoteDate
  )
  
  return customerThreads.length > 0
}
```

## Benefits

### Cost Savings
- Reduce API calls by ~60-70% on ongoing conversations
- Only generate responses when customer escalates
- Skip unchanged back-and-forth conversations

### Better User Experience
- Fewer duplicate notes cluttering tickets
- Agents see when customer frustration increases
- More meaningful note history

### Smarter Escalation
- Automatically detects when customer is getting angrier
- Flags conversations that are deteriorating
- Helps prioritize which tickets need attention

## Edge Cases

### Customer Apologizes / Calms Down
- If scores decrease significantly, don't create new note
- Let agent see the de-escalation naturally
- Could optionally note "Customer de-escalated"

### Multiple Quick Replies
- Check timestamp of last note
- If < 15 minutes ago, combine into single analysis
- Prevents spam from rapid-fire messages

### Edited Messages
- HelpScout doesn't show edit history
- Treat as new message if content changed
- Compare against original analysis

## Monitoring & Metrics

Track:
- % of conversations with escalating sentiment
- Average number of notes per conversation (should decrease)
- API cost savings
- Agent feedback on note relevance

## Future Enhancements

1. **Escalation Alerts**
   - Send Teams notification if anger/urgency crosses 80
   - Alert supervisor for extreme escalations

2. **Sentiment Trends**
   - Track sentiment over entire conversation
   - Show graph of anger/urgency over time
   - Identify patterns in escalation

3. **Smart Thresholds**
   - Learn optimal increase thresholds
   - Adjust based on ticket category
   - Personalize per customer history

## Implementation Priority
- High priority - immediate cost savings
- Can implement alongside AI sentiment analysis
- Test on subset of tickets first