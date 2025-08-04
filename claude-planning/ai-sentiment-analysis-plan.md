# AI-Based Sentiment Analysis for HelpScout Tickets

**Type**: Implementation Plan

## Overview
Replace keyword-based anger detection with AI-powered sentiment analysis using OpenAI or Claude API to better understand customer emotions and context.

## User Need
- Current keyword-based system misses nuanced sentiment
- Can't understand context (e.g., "bad" in "not bad" vs "bad service")
- Misses sarcasm, passive-aggressive tone, and implied frustration
- Need more accurate anger/urgency detection

## Implementation Steps

### 1. Choose AI Provider
- **Option A: OpenAI GPT-4**
  - Pros: Fast, good at sentiment analysis, easy integration
  - Cons: Cost per token, requires API key management
  
- **Option B: Claude API**
  - Pros: Excellent at understanding context, good safety features
  - Cons: Higher cost, rate limits

### 2. Design System Prompt
```
You are a customer sentiment analyzer for a fantasy football support system.
Analyze the following customer message and return a JSON response with:
- anger_score: 0-100 (based on tone, language, frustration level)
- urgency_score: 0-100 (based on time sensitivity, subscription issues)
- is_spam: boolean
- categories: array of ['angry', 'urgent', 'subscription-related', 'bug-report', 'spam']
- key_indicators: array of specific phrases that led to your assessment
- suggested_priority: 'high', 'medium', 'low'
- sentiment_summary: brief explanation of customer's emotional state

Consider:
- Profanity and hostile language
- Capitalization patterns
- Multiple punctuation (!!!, ???)
- Threats to cancel or leave negative reviews
- Mentions of payment/billing issues
- Time-based urgency ("need this now", "been waiting weeks")
- Overall tone and context
```

### 3. Integration Architecture
```typescript
interface AISentimentAnalyzer {
  async analyze(text: string): Promise<{
    angerScore: number
    urgencyScore: number
    isSpam: boolean
    categories: string[]
    keyIndicators: string[]
    suggestedPriority: 'high' | 'medium' | 'low'
    sentimentSummary: string
    confidence: number
  }>
}
```

### 4. Hybrid Approach (Phase 1)
- Use keyword detection for obvious cases (profanity, spam keywords)
- Send ambiguous cases to AI for analysis
- This reduces API costs while improving accuracy
- **Key Strategy**: Only send tickets that AREN'T flagged as high-urgency to AI
  - Prefer false positives over false negatives
  - False positives can be manually removed
  - False negatives mean missing upset customers
- AI acts as a safety net to catch subtle anger/frustration missed by keywords

### 5. Caching Strategy
- Cache AI responses for similar messages
- Use embedding similarity to find cached results
- Expire cache after 30 days

### 6. Cost Management
- Set daily/monthly limits
- Use GPT-3.5 for initial screening, GPT-4 for complex cases
- Batch analyze during off-peak hours
- Skip AI for very short messages (<20 words)

## Testing Plan
- Compare AI results with human-labeled test set
- A/B test keyword vs AI detection on live tickets
- Monitor false positive/negative rates
- Test with edge cases (sarcasm, typos, mixed sentiment)

## Monitoring
- Track API costs per ticket
- Response time impact
- Accuracy improvements over keyword system
- Customer satisfaction changes

## Implementation Phases

### Phase 1: Proof of Concept (1 week)
- Set up API integration
- Test on historical angry tickets
- Compare results with keyword system

### Phase 2: Hybrid System (2 weeks)
- Implement fallback logic
- Add caching layer
- Deploy to production with small % of tickets

### Phase 3: Full Rollout (1 week)
- Process all tickets through AI
- Implement cost controls
- Add monitoring dashboard

## Estimated Costs
- ~$0.01-0.03 per ticket analyzed (GPT-4)
- ~$0.002-0.005 per ticket (GPT-3.5-turbo)
- For 200 tickets/day: $2-6/day with GPT-4

## Notes
- Consider fine-tuning a model on historical support tickets
- Could extend to generate suggested responses
- Privacy: Ensure no PII is sent to AI providers
- Could analyze patterns across tickets to identify systemic issues