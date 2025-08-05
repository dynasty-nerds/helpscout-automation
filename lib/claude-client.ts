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
7. Do NOT include any closing signature - HelpScout adds this automatically
8. Show empathy for frustrated customers and acknowledge their feelings
9. NEVER tell customers to "contact support" - they already have!
10. Use TWO line breaks between paragraphs for easy readability
11. IMPORTANT: Complete each sentence before adding line breaks - never break in the middle of a sentence
12. When mentioning URLs, try these formats: 
    - For internal links: https://dynastynerds.com/my-account
    - For support links: https://support.dynastynerds.com/article/15-manage-subscriptions
    - Always include https:// to ensure links are clickable

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
- Use the current year when needed, but prefer terms like 'last season' or 'this season' unless specific years are mentioned
- This rollover period often causes sync issues as it requires manual work on our end
- Standard first troubleshooting step for ANY league sync issue: remove and re-add the league host account from the Accounts tab on the app homepage
- This also applies when users join new leagues - they need to remove and re-add their account to see the new league

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

RELATIONSHIP BETWEEN DOCUMENTS:
- Common Support Issue Categories: Defines issue types for categorization
- Fix Changelog: Contains specific fixes with implementation dates and instructions
- Known Issues: Contains currently active issues we're aware of and working on
- These may overlap - an issue category might have a recent fix OR be a known active issue
- When an issue matches multiple documents, reference ALL applicable ones
- Priority: Fix Changelog (check FIRST for solutions) > Known Issues (active problems) > General docs
- ALWAYS check Fix Changelog FIRST for any issue the customer mentions

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

RESPONSE GENERATION STEPS:
1. FIRST check Fix Changelog for any fixes matching the customer's issue
2. If a fix exists, use it as the primary solution in your response
3. ONLY suggest general troubleshooting if no specific fix is found in the changelog
4. Use current year context appropriately - don't guess specific years from the past`

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
        issueCategory: result.issueCategory
      }

    } catch (error: any) {
      console.error('Claude API error:', error.response?.data || error.message)
      console.error('Full error:', JSON.stringify(error.response?.data || error, null, 2))
      
      // Fallback response if Claude fails
      return {
        suggestedResponse: "I'd be happy to help you with this issue. Let me look into this and get back to you shortly.",
        confidence: 0.5,
        referencedDocs: [],
        referencedUrls: [],
        reasoning: "Fallback response due to API error",
        responseType: "general",
        notesForAgent: `Error calling Claude API: ${error.message}`,
        usageString: '💰 Claude Usage: $0.0000 for this request (API call failed)',
        angerScore: 0,
        urgencyScore: 0,
        angerTriggers: [],
        urgencyTriggers: [],
        isSpam: false,
        sentimentReasoning: 'Failed to analyze sentiment due to API error',
        error: true,
        errorMessage: error.message
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