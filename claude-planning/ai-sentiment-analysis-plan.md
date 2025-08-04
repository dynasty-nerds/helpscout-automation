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

### 1. AI Provider: Claude 3.5 Sonnet
- **Use existing Claude 3.5 Sonnet setup** (same as response generation)
- Already integrated and working well
- Excellent at understanding context and nuance
- Cost-effective at ~$0.01 per ticket
- Can combine sentiment + response in single API call

### 2. Design System Prompt

#### Core Sentiment Analysis Principles

**URGENCY (0-100)** - Based on demands and time pressure, NOT the topic:
- Demanding immediate action: "I need this NOW", "fix this today", "ASAP"
- Frustration about response times: "Why is nobody getting back to me?", "3rd email", "waiting for days"
- Multiple CAPS words (excluding abbreviations like ESPN, NFL, API)
- Time-sensitive language: "immediately", "right away", "urgent", "today"
- Threatening actions: "I'll dispute the charge", "canceling", "going to competitor"
- Exasperation questions: "What is going on?", "How is this still not fixed?"

**ANGER (0-100)** - Based on tone and language, NOT the topic:
- Profanity/swearing (including masked: f***, hell, damn, WTF)
- Personal attacks: "horrible customer service", "you people are incompetent"
- Hostile language: "this is ridiculous", "what the hell", "absolutely unacceptable"
- Excessive CAPS LOCK (full sentences or many words)
- Mean-spirited sarcasm or passive-aggressive tone
- Name-calling or insults directed at company/support

**Scoring Guidelines:**
- 0-20: Polite, patient, understanding tone
- 21-40: Mildly frustrated but reasonable
- 41-60: Clearly upset, demanding action
- 61-80: Very angry/urgent, hostile tone
- 81-100: Extreme anger, profanity, threats

```
You are a customer sentiment analyzer for a support ticket system.
Analyze the customer message and return ONLY a JSON response with these exact fields:

{
  "angerScore": 0-100 (based on tone/language/hostility as described above),
  "urgencyScore": 0-100 (based on demands/time pressure as described above),
  "isSpam": boolean,
  "issueCategory": "refund-cancellation" | "bug-broken" | "spam" | "other",
  "angerTriggers": ["specific phrases showing anger"],
  "urgencyTriggers": ["specific phrases showing urgency"],
  "reasoning": "Brief explanation of scores"
}

Remember:
- Technical issues alone don't increase anger score
- Billing issues alone don't increase urgency score
- Focus on HOW they express issues, not WHAT the issue is
- Look for cumulative effect of multiple indicators
```

### 3. Integration Architecture
```typescript
// New AI-powered sentiment analyzer
class ClaudeSentimentAnalyzer {
  async analyze(text: string): Promise<SentimentResult> {
    const response = await claudeClient.analyzeSentiment(text)
    
    return {
      angerScore: response.angerScore,
      urgencyScore: response.urgencyScore,
      isAngry: response.angerScore >= 40,
      isHighUrgency: response.urgencyScore >= 60,
      isSpam: response.isSpam,
      indicators: {
        hasProfanity: response.angerTriggers.some(t => /* profanity check */),
        profanityCount: /* count from triggers */,
        profanityFound: response.angerTriggers.filter(/* profanity */),
        hasNegativeWords: response.angerScore > 20,
        negativeWordCount: response.angerTriggers.length,
        negativeWordsFound: response.angerTriggers,
        negativeContextCount: 0,
        negativeContextFound: [],
        capsRatio: this.calculateCapsRatio(text),
        urgencyKeywords: response.urgencyTriggers,
        subscriptionMentions: /* count from text */,
        isPoliteRequest: response.angerScore < 20,
        spamIndicatorCount: response.isSpam ? 1 : 0
      },
      categories: this.determineCategories(response),
      issueCategory: response.issueCategory
    }
  }
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
- Current total cost: ~$0.01 per ticket (includes response generation)
- Additional sentiment analysis: ~$0.002-0.003 per ticket (Claude Haiku)
- Could use same Claude API call for both sentiment + response (no extra cost)
- For 200 tickets/day: ~$2/day total (both sentiment + responses)

## Implementation Strategy

### Option 1: Separate Sentiment Call (More Flexible)
- Call Claude first ONLY for sentiment analysis (cheaper, faster)
- Use results to determine if we need response generation
- Skip response generation for spam tickets
- Can use Claude Haiku for sentiment (cheaper than Sonnet)

### Option 2: Combined Call (More Efficient)
- Single Claude API call returns both sentiment AND response
- Modify existing prompt to include sentiment analysis
- No additional API cost
- Slightly larger response tokens

### Recommended: Start with Option 2
- Easier to implement
- No additional costs
- Can always split later if needed
- Test accuracy vs current regex system

## Example Combined Prompt Addition
```
Before generating the response, first analyze the sentiment:

SENTIMENT ANALYSIS:
{
  "angerScore": [0-100 based on tone/hostility],
  "urgencyScore": [0-100 based on demands/time pressure],
  "angerTriggers": ["hostile phrases found"],
  "urgencyTriggers": ["urgent phrases found"],
  "isSpam": boolean
}

Then generate your response as before...
```

## Notes
- Current regex system works well for obvious cases
- AI will catch subtle frustration and sarcasm
- Monitor for over-sensitivity to avoid false positives
- Keep anger threshold at 40 and urgency at 60
- Can A/B test AI vs regex sentiment on same tickets