import axios from 'axios'
import { UsageTracker } from './usage-tracker'

interface ClaudeResponse {
  suggestedResponse: string
  confidence: number
  referencedDocs: string[]
  referencedUrls?: string[]
  reasoning: string
  responseType: string
  notesForAgent?: string
  usageString?: string
  // Sentiment analysis fields
  angerScore?: number
  urgencyScore?: number
  angerTriggers?: string[]
  urgencyTriggers?: string[]
  isSpam?: boolean
  sentimentReasoning?: string
  // Error handling
  error?: boolean
  errorMessage?: string
  // Issue categorization
  issueCategory?: string
  // Usage tracking
  cost?: number
  inputTokens?: number
  outputTokens?: number
}

export class ClaudeClient {
  private apiKey: string
  private baseURL = 'https://api.anthropic.com/v1/messages'
  private usageTracker: UsageTracker

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('CLAUDE_API_KEY environment variable is required')
    }
    this.usageTracker = new UsageTracker()
  }

  async generateResponse(
    customerMessage: string,
    conversationHistory: string,
    relevantDocs: any[],
    customerFirstName?: string
  ): Promise<ClaudeResponse> {
    console.log(`ClaudeClient.generateResponse called with customerFirstName: "${customerFirstName}"`)
    
    // Format documentation for context
    const docsContext = relevantDocs.map(doc => 
      `**${doc.name || doc.title}**\n${doc.text || doc.content || ''}\nURL: ${doc.publicUrl || doc.url || ''}\n`
    ).join('\n---\n')

    const greeting = customerFirstName ? `Hey ${customerFirstName},` : 'Hey,'
    
    const systemPrompt = `You are generating a SUGGESTED RESPONSE for a DynastyNerds support agent to send to a customer. The agent has full access to process refunds, change subscriptions, and take any necessary actions.

CRITICAL INSTRUCTIONS:
1. Start with "${greeting}" followed by TWO line breaks for readability
2. Generate the response AS IF the agent is speaking - they can take actions like processing refunds
3. Do NOT use bold text or markdown formatting
4. Be VERY friendly, warm, and conversational in tone
5. Base responses ONLY on the provided documentation - never guess or hallucinate
6. If documentation is missing, note this in the reasoning/notes section, not in the response
7. NEVER make up actions like "I'll refresh your sync" or "wait 15 minutes" - only use documented solutions
8. If your issueCategory matches a Fix Changelog entry title, you MUST use that fix
9. Do NOT include any closing signature - HelpScout adds this automatically
10. Show empathy for frustrated customers and acknowledge their feelings
11. NEVER tell customers to "contact support" - they already have!
12. Use TWO line breaks between paragraphs for easy readability
13. IMPORTANT: Complete each sentence before adding line breaks - never break in the middle of a sentence
14. When mentioning URLs, try these formats: 
    - For internal links: https://dynastynerds.com/my-account
    - For support links: https://support.dynastynerds.com/article/15-manage-subscriptions
    - Always include https:// to ensure links are clickable
15. CRITICAL - MEMBERPRESS DATA: When MemberPress data is provided, ONLY reference transactions that appear in that data. Do NOT accept or repeat payment claims from customers unless verified in MemberPress. Trust the database over customer claims.

CRITICAL - CHECK FIX CHANGELOG FIRST:
BEFORE generating any response, you MUST check if there's a "Fix Changelog" document that contains a fix matching the user's issue.
The Fix Changelog is your PRIMARY source for recent fixes - always check it FIRST for ANY issue.
If a fix exists in the changelog that matches the user's issue with high confidence, you MUST reference it and provide those exact instructions. 

When using the Fix Changelog:
- The format is:
  Title (as a header)
  Date: [date]
  What it fixes: [description]
  How customer can fix: [instructions]
- Example entry:
  2025 ESPN rollovers fixed
  Date: 08/05/2025
  What it fixes: fixes ESPN league sync issues
  How customer can fix: to fix issue, simply remove your ESPN account from the 'Account' tab on the app homepage and re-add it
- If you find a fix that clearly matches the user's issue, DO mention that "we recently fixed this issue"
- ALWAYS include "Fix Changelog" in your referencedDocs array when you use information from it
- The Date field IS the specific date when the fix was implemented - always use it when referencing the fix
- Always format dates in a friendly way (e.g., "This was fixed on August 5th" not "08/05")
- Convert date format: 08/05/2025 → "August 5th"
- CRITICAL: Use the EXACT steps from "How customer can fix" - just make them sound friendly
- Example: If it says "to fix issue, simply remove your ESPN account from the 'Account' tab on the app homepage and re-add it"
  You should say: "To get this working, you'll need to remove your ESPN account from the 'Account' tab on the app homepage and re-add it"
- DO NOT add extra steps like "sign out and back in" unless they're specifically in the Fix Changelog
- Focus on fixes from the past 3-6 months as most relevant (older fixes may be stale)
- Use your judgment: very recent fixes (past 3 months) are highly relevant, 3-6 months are still useful, older than 6 months use with caution
- NEVER say "according to our fix changelog" or mention the document name - just say "we recently fixed this"
- ALWAYS check the Fix Changelog for ANY issue mentioned by the customer - match fixes to the EXACT platform/issue they mention
- League sync issues, player ID matching issues, roster display issues, and draft pick problems are PLATFORM-SPECIFIC: ESPN fixes only apply to ESPN, MFL fixes only to MFL, etc.
- Other issues (billing, general app features, etc.) may be platform-agnostic - use your judgment

MANDATORY FIX CHANGELOG CHECK:
Before writing ANY response, scan the Fix Changelog for fixes that match the customer's issue. Match based on:
1. Platform mentioned (ESPN, MFL, Sleeper, etc.) AND issue type (sync, display, rollover, etc.)
2. The "What it fixes" description - this tells you what issues the fix addresses
3. Don't require exact title match - look at the content and context
4. REMEMBER: "rollover" fixes often solve "sync" issues, especially when customers mention "since last season"

Examples of matching:
- Customer: "ESPN sync issue" → Look for ESPN rollover or sync fixes
- Customer: "My Sleeper league hasn't synced since last season" → Look for Sleeper rollover fixes
- Customer: "MFL league not updating" → Look for MFL rollover or sync fixes
- Customer: "League analyzer not synced since last year" + mentions ESPN → Look for ESPN rollover fixes

If you find a matching fix:
- You MUST use those exact instructions as your primary solution
- Do NOT suggest any other troubleshooting steps unless the Fix Changelog solution doesn't work
- Reference the fix naturally: "I see you're having trouble with [platform] sync. Good news - we recently fixed this issue on [date]."
- For rollover fixes, acknowledge the seasonal transition: "This is related to the league rollover for the new season, which we fixed on [date]."

KNOWN ISSUES DOCUMENTATION:
If you see a document titled "Known Issues" (exact name), this is an INTERNAL reference for currently active issues we're aware of and working on.

When using the Known Issues document:
- The format is:
  Title
  Date of identification: [date]
  What it negatively impacts: [description]
  Expected resolution: [timeline or status]
- If a customer's issue matches a known issue, acknowledge we're aware and working on it
- Say something like: "I see you're experiencing [issue]. We're aware of this issue and our team is actively working on a fix."
- DO NOT give specific dates unless the Expected resolution explicitly provides one
- Always include "Known Issues" in your referencedDocs array when you reference it
- Focus on acknowledging the issue and that we're working on it
- NEVER say "according to our known issues list" - just acknowledge we know about it

IMPORTANT POLICIES:
- Agents can process refunds, subscription changes, and account modifications
- If suggesting a refund or account change, write it as done: "I've processed your refund"
- For users wanting to sign back up with their grandfathered rate, they can use coupon code NERD-RETRO on sign up to get the grandfathered rate

LEAGUE SYNC CONTEXT:
- We support 5 league platforms: ESPN, Sleeper, MFL, Fleaflicker, and FFPC
- During offseason (February-August after Super Bowl), leagues roll over from previous year to current year
- IMPORTANT: "League rollover" and "league sync" issues are closely related - rollover is when a new league is created for the new season, which often causes sync issues
- When customers mention "hasn't synced since last season" or similar, this is likely a rollover issue
- Use the current year when needed, but prefer terms like 'last season' or 'this season' unless specific years are mentioned
- This rollover period often causes sync issues as it requires manual work on our end
- Standard first troubleshooting step for ANY league sync issue: remove and re-add the league host account from the Accounts tab on the app homepage
- This also applies when users join new leagues - they need to remove and re-add their account to see the new league
- KEY TERMS THAT INDICATE ROLLOVER ISSUES: "since last season", "new season", "2024 to 2025", "hasn't updated", "stuck on old roster"

DOCUMENTATION CONTEXT:
${docsContext}

CONVERSATION HISTORY:
${conversationHistory}

IMPORTANT: The conversation history above includes both customer messages and agent responses. When generating your suggested response:
- Review what agents have already told the customer
- Do NOT repeat instructions or solutions already provided
- If an agent already suggested the standard fix, acknowledge it and provide next steps
- Build upon previous responses rather than starting over

CUSTOMER'S LATEST MESSAGE:
${customerMessage}

ISSUE CATEGORIZATION:
You will receive a document containing common support issue categories. Use it to determine the best category for this customer's issue. Choose the most specific category that matches their problem. If no category fits well, create a brief descriptive category (3-5 words max). This categorization helps agents quickly understand the issue type.

MEMBERPRESS SUBSCRIPTION CATEGORIES:
If the customer mentions any of these keywords, categorize as "MemberPress Access Issue":
- Can't access app/premium features
- Being asked to pay/upgrade when they shouldn't be
- Lost access to content they had before
- "No premium" or "premium locked"

If the customer mentions any of these keywords, categorize as "MemberPress Billing Query":
- How much they're paying
- Billing history questions
- Claiming grandfathered rate
- Transaction/charge questions

If the customer mentions any of these keywords, categorize as "MemberPress Cancellation":
- Cancel subscription
- Want refund
- Stop billing
- Unsubscribe

MEMBERPRESS DATA HANDLING:
When MemberPress Subscription Data is provided in the conversation history:
1. Always say "I've checked your account" when referencing their subscription status
2. For userFound: false → "I couldn't find any subscription history for [email]. This could mean you either haven't signed up yet, or you may have used a different email address when subscribing."
3. For hasTransactions: false → "I found your account but don't see any subscription history. If you believe you should have access, you may have subscribed using a different email address."
4. For hasActiveSubscription: true → Mention the subscription type and expiration date
5. For hasActiveSubscription: false → Check the most recent transaction date IN THE MEMBERPRESS DATA
6. For gateway: 'manual' → Direct to App Store cancellation
7. For other gateways → Offer to process cancellation directly
8. Be specific with dates and amounts when available in the transaction history

CRITICAL: Only reference payments/transactions that appear in the MemberPress data. Do NOT mention any payments the customer claims to have made unless they appear in the MemberPress transaction history. If the customer mentions a payment that doesn't appear in MemberPress data, acknowledge their claim but clarify what our records show.

Example: If customer says "I paid on July 30th" but MemberPress shows last payment June 30th, say:
"I've checked your account and I see your most recent payment in our system was on June 30th for $2.99. Your subscription expired on July 30th. I don't see the July 30th payment you mentioned in our records."

PAYMENT SYNC FACTS:
- ALL payments sync instantly to our system - there is NO delay
- PayPal, Stripe, manual payments - all appear immediately in MemberPress
- NEVER tell customers to "wait a day or two" for payments to sync
- If a payment isn't showing, it either failed or was made with a different email
- Signing out and back in does NOT help with payment issues

SCREENSHOT HANDLING:
- ALWAYS check if customer mentioned providing screenshots/attachments
- Common phrases: "see attached", "I've attached", "screenshots below", "here's a screenshot"
- NEVER ask for screenshots if customer already said they provided them
- Acknowledge their screenshots: "I see the screenshots you provided"

RELATIONSHIP BETWEEN DOCUMENTS:
- Common Support Issue Categories: Defines issue types for categorization
- Fix Changelog: Contains specific fixes with implementation dates and instructions
- Known Issues: Contains currently active issues we're aware of and working on
- These may overlap - an issue category might have a recent fix OR be a known active issue
- When an issue matches multiple documents, reference ALL applicable ones
- Priority: Fix Changelog (check FIRST for solutions) > Known Issues (check SECOND for active problems) > General docs
- ALWAYS check Fix Changelog FIRST for any issue the customer mentions
- ALWAYS check Known Issues SECOND - especially for payment gateway issues (PayPal, Stripe, etc.)

SENTIMENT ANALYSIS INSTRUCTIONS:
Before generating the response, analyze the customer's sentiment using these guidelines:

URGENCY (0-100) - Based on demands and time pressure, NOT the topic:
- Demanding immediate action: "I need this NOW", "fix this today", "ASAP" (60-80)
- Frustration about response times: "Why is nobody getting back to me?", "3rd email", "waiting for days" (40-60)
- Multiple CAPS words (excluding abbreviations like ESPN, NFL, API) (add 10-20)
- Time-sensitive language: "immediately", "right away", "urgent", "today" (40-60)
- Threatening actions: "I'll dispute the charge", "canceling", "going to competitor" (60-80)
- Exasperation questions: "What is going on?", "How is this still not fixed?" (40-60)

ANGER (0-100) - Based on tone and language, NOT the topic:
- Profanity/swearing (including masked: f***, hell, damn, WTF) (60-100)
- Personal attacks: "horrible customer service", "you people are incompetent" (60-80)
- Hostile language: "this is ridiculous", "what the hell", "absolutely unacceptable" (40-60)
- Excessive CAPS LOCK (full sentences or many words) (40-60)
- Mean-spirited sarcasm or passive-aggressive tone (40-60)
- Name-calling or insults directed at company/support (60-80)

Scoring Guidelines:
- 0-20: Polite, patient, understanding tone
- 21-40: Mildly frustrated but reasonable
- 41-60: Clearly upset, demanding action
- 61-80: Very angry/urgent, hostile tone
- 81-100: Extreme anger, profanity, threats

Please respond with a JSON object in this exact format. IMPORTANT: Use \\n for line breaks within JSON string values, not actual newlines:
{
  "issueCategory": "Brief category from Common Support Issue Categories doc or custom 3-5 word description",
  "angerScore": 0-100,
  "urgencyScore": 0-100,
  "angerTriggers": ["specific phrases showing anger"],
  "urgencyTriggers": ["specific phrases showing urgency"],
  "isSpam": false,
  "sentimentReasoning": "Brief explanation of sentiment scores",
  "suggestedResponse": "The actual response text starting with ${greeting}... Use \\n\\n for paragraph breaks",
  "confidence": 0.95,
  "referencedDocs": ["article names/titles of docs referenced"],
  "referencedUrls": ["actual helpscout doc URLs for agent reference"],
  "reasoning": "Why this response addresses their issue...",
  "responseType": "billing|technical|account|general",
  "notesForAgent": "Any missing documentation, suggested improvements, or important context for the agent. Use bullet points starting with '- ' for lists. Format: '- Item 1\\n- Item 2\\n\\nAdditional text after bullets'. DO NOT say Fix Changelog is missing information if the fix is actually there - verify before claiming something is missing."
}

CRITICAL RESPONSE GENERATION RULES:
1. You MUST check the Fix Changelog FIRST - if it contains a fix for the issue category you identified, you MUST use those exact instructions
2. You MUST check Known Issues SECOND - especially for payment gateway issues (PayPal, Stripe, Apple Pay, etc.)
3. NEVER suggest actions we will take (like "I'll refresh your sync") - only provide steps the customer can take themselves
4. NEVER hallucinate solutions - ALL troubleshooting steps MUST come from the provided documentation
5. If Fix Changelog has ANY fix related to the customer's platform + issue type, you MUST use that fix
6. DO NOT make up wait times, refresh instructions, or sync processes that aren't in the documentation
7. ROLLOVER = SYNC ISSUES: When customer mentions "not synced since last season/year", CHECK FOR ROLLOVER FIXES FIRST
8. The Fix Changelog is your BIBLE - if a fix exists there for the customer's issue, that's your primary solution
9. Known Issues is your SECOND BIBLE - if an issue matches Known Issues (especially payment issues), acknowledge it's a known problem`

    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: systemPrompt
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      )

      const content = response.data.content[0].text
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response')
      }

      // Clean the JSON string to handle common issues
      let jsonString = jsonMatch[0]
      
      // Log the raw JSON for debugging
      console.log('Raw Claude JSON response (first 500 chars):', jsonString.substring(0, 500))
      
      // Log specific fields for debugging after parsing
      try {
        const tempParse = JSON.parse(jsonString)
        if (tempParse.issueCategory) {
          console.log(`Claude returned issueCategory: "${tempParse.issueCategory}"`)
        } else {
          console.log(`Claude did not return an issueCategory field`)
        }
      } catch (e) {
        console.log('Could not parse response for issueCategory logging')
      }
      
      let result
      try {
        result = JSON.parse(jsonString)
      } catch (parseError: any) {
        console.error('JSON parse error:', parseError.message)
        console.error('Full JSON string:', jsonString)
        
        // Try to fix common JSON issues - more robust approach
        console.error('Bad character at position 38:', jsonString.charCodeAt(38), jsonString.charAt(38))
        console.error('Context around position 38:', jsonString.substring(30, 50))
        
        // First, escape all control characters
        let fixedJson = jsonString.replace(/[\x00-\x1F\x7F]/g, (char: string) => {
          switch (char) {
            case '\n': return '\\n'
            case '\r': return '\\r'
            case '\t': return '\\t'
            case '\b': return '\\b'
            case '\f': return '\\f'
            default: return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4)
          }
        })
        
        try {
          result = JSON.parse(fixedJson)
        } catch (secondError) {
          console.error('Failed to parse even after cleanup:', secondError)
          // Try one more time with manual extraction
          try {
            console.log('Attempting manual extraction from malformed JSON')
            
            // Use regex patterns that work without the 's' flag
            const responseMatch = jsonString.match(/"suggestedResponse":\s*"((?:[^"\\]|\\.)*)"/)
            const suggestedResponse = responseMatch?.[1] || ''
            
            const confidenceMatch = jsonString.match(/"confidence":\s*([\d.]+)/)
            const confidence = parseFloat(confidenceMatch?.[1] || '0.5')
            
            const typeMatch = jsonString.match(/"responseType":\s*"([^"]*)"/)
            const responseType = typeMatch?.[1] || 'general'
            
            const reasoningMatch = jsonString.match(/"reasoning":\s*"((?:[^"\\]|\\.)*)"/)
            const reasoning = reasoningMatch?.[1]?.replace(/\\n/g, '\n') || 'Response generated successfully'
            
            const notesMatch = jsonString.match(/"notesForAgent":\s*"((?:[^"\\]|\\.)*)"/)
            const notesForAgent = notesMatch?.[1]?.replace(/\\n/g, '\n') || ''
            
            // Extract sentiment fields
            const angerScoreMatch = jsonString.match(/"angerScore":\s*([\d.]+)/)
            const angerScore = angerScoreMatch ? parseFloat(angerScoreMatch[1]) : undefined
            
            const urgencyScoreMatch = jsonString.match(/"urgencyScore":\s*([\d.]+)/)
            const urgencyScore = urgencyScoreMatch ? parseFloat(urgencyScoreMatch[1]) : undefined
            
            const isSpamMatch = jsonString.match(/"isSpam":\s*(true|false)/)
            const isSpam = isSpamMatch ? isSpamMatch[1] === 'true' : undefined
            
            const sentimentReasoningMatch = jsonString.match(/"sentimentReasoning":\s*"((?:[^"\\]|\\.)*)"/)
            const sentimentReasoning = sentimentReasoningMatch?.[1]?.replace(/\\n/g, '\n') || undefined
            
            // Extract arrays - use [\s\S] instead of . with s flag
            let referencedDocs: string[] = []
            let referencedUrls: string[] = []
            let angerTriggers: string[] = []
            let urgencyTriggers: string[] = []
            
            const docsMatch = jsonString.match(/"referencedDocs":\s*\[([\s\S]*?)\]/)
            if (docsMatch) {
              referencedDocs = docsMatch[1].match(/"([^"]*)"/g)?.map((s: string) => s.replace(/"/g, '')) || []
            }
            
            const urlsMatch = jsonString.match(/"referencedUrls":\s*\[([\s\S]*?)\]/)
            if (urlsMatch) {
              referencedUrls = urlsMatch[1].match(/"([^"]*)"/g)?.map((s: string) => s.replace(/"/g, '')) || []
            }
            
            const angerTriggersMatch = jsonString.match(/"angerTriggers":\s*\[([\s\S]*?)\]/)
            if (angerTriggersMatch) {
              angerTriggers = angerTriggersMatch[1].match(/"([^"]*)"/g)?.map((s: string) => s.replace(/"/g, '')) || []
            }
            
            const urgencyTriggersMatch = jsonString.match(/"urgencyTriggers":\s*\[([\s\S]*?)\]/)
            if (urgencyTriggersMatch) {
              urgencyTriggers = urgencyTriggersMatch[1].match(/"([^"]*)"/g)?.map((s: string) => s.replace(/"/g, '')) || []
            }
            
            const issueCategoryMatch = jsonString.match(/"issueCategory":\s*"((?:[^"\\]|\\.)*)"/)
            const issueCategory = issueCategoryMatch?.[1]?.replace(/\\n/g, '\n') || undefined
            
            result = {
              suggestedResponse: suggestedResponse.replace(/\\n/g, '\n'),
              confidence,
              referencedDocs,
              referencedUrls,
              reasoning,
              responseType,
              notesForAgent,
              angerScore,
              urgencyScore,
              angerTriggers,
              urgencyTriggers,
              isSpam,
              sentimentReasoning,
              issueCategory
            }
            
            console.log('Manual extraction successful')
          } catch (finalError) {
            throw new Error('Invalid JSON response from Claude')
          }
        }
      }
      
      // Track usage
      const inputTokens = response.data.usage?.input_tokens || 0
      const outputTokens = response.data.usage?.output_tokens || 0
      console.log(`Claude API usage: ${inputTokens} input tokens, ${outputTokens} output tokens`)
      
      const usage = await this.usageTracker.trackUsage(inputTokens, outputTokens)
      const usageString = this.usageTracker.formatUsageString(usage)
      const cost = this.estimateCost(inputTokens, outputTokens)
      
      return {
        suggestedResponse: result.suggestedResponse,
        confidence: result.confidence,
        referencedDocs: result.referencedDocs || [],
        referencedUrls: result.referencedUrls || [],
        reasoning: result.reasoning,
        responseType: result.responseType,
        notesForAgent: result.notesForAgent || '',
        usageString,
        angerScore: result.angerScore,
        urgencyScore: result.urgencyScore,
        angerTriggers: result.angerTriggers || [],
        urgencyTriggers: result.urgencyTriggers || [],
        isSpam: result.isSpam,
        sentimentReasoning: result.sentimentReasoning,
        issueCategory: result.issueCategory,
        cost,
        inputTokens,
        outputTokens
      }

    } catch (error: any) {
      console.error('Claude API error:', error.response?.data || error.message)
      console.error('Full error:', JSON.stringify(error.response?.data || error, null, 2))
      
      // Check for specific error types
      let errorMessage = error.message
      let notesForAgent = `Error calling Claude API: ${error.message}`
      
      if (error.response?.data?.error?.type === 'invalid_request_error' && 
          error.response?.data?.error?.message?.includes('credit balance is too low')) {
        errorMessage = 'Claude API: Credit balance too low'
        notesForAgent = 'CLAUDE API ERROR: Credit balance is too low. Please add credits to your Anthropic account at https://console.anthropic.com/settings/plans'
        console.error('⚠️  CREDIT BALANCE TOO LOW - Please add credits to your Anthropic account')
      } else if (error.response?.status === 400) {
        errorMessage = `Claude API: Bad request (${error.response?.data?.error?.message || 'Unknown error'})`
        notesForAgent = `CLAUDE API ERROR (400): ${error.response?.data?.error?.message || 'Bad request'}`
      } else if (error.response?.status === 401) {
        errorMessage = 'Claude API: Authentication failed'
        notesForAgent = 'CLAUDE API ERROR: Authentication failed. Please check your API key.'
      } else if (error.response?.status === 429) {
        errorMessage = 'Claude API: Rate limit exceeded'
        notesForAgent = 'CLAUDE API ERROR: Rate limit exceeded. Please try again later.'
      }
      
      // Fallback response if Claude fails
      return {
        suggestedResponse: "I'd be happy to help you with this issue. Let me look into this and get back to you shortly.",
        confidence: 0.5,
        referencedDocs: [],
        referencedUrls: [],
        reasoning: "Fallback response due to API error",
        responseType: "general",
        notesForAgent,
        usageString: '💰 Claude Usage: $0.0000 for this request (API call failed)',
        angerScore: 0,
        urgencyScore: 0,
        angerTriggers: [],
        urgencyTriggers: [],
        isSpam: false,
        sentimentReasoning: 'Failed to analyze sentiment due to API error',
        error: true,
        errorMessage
      }
    }
  }

  // Simple cost estimation
  estimateCost(inputTokens: number, outputTokens: number): number {
    // Claude 3.5 Sonnet pricing: $3/1M input, $15/1M output
    const inputCost = (inputTokens / 1000000) * 3
    const outputCost = (outputTokens / 1000000) * 15
    return inputCost + outputCost
  }
}