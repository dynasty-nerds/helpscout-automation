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
    
    // Format documentation for context
    const docsContext = relevantDocs.map(doc => 
      `**${doc.name || doc.title}**\n${doc.text || doc.content || ''}\nURL: ${doc.publicUrl || doc.url || ''}\n`
    ).join('\n---\n')

    const greeting = customerFirstName ? `Hey ${customerFirstName},` : 'Hey,'
    
    const systemPrompt = `You are generating a SUGGESTED RESPONSE for a DynastyNerds support agent to send to a customer. The agent has full access to process refunds, change subscriptions, and take any necessary actions.

CRITICAL INSTRUCTIONS:
1. Start with "${greeting}" followed by TWO line breaks for readability
2. Generate the response AS IF the agent is speaking - they can take actions like processing refunds
3. Do NOT use bold text or markdown formatting - HelpScout notes don't support it
4. Be VERY friendly, warm, and conversational in tone
5. Base responses ONLY on the provided documentation - never guess or hallucinate
6. If documentation is missing, note this in the reasoning/notes section, not in the response
7. Do NOT include any closing signature - HelpScout adds this automatically
8. Show empathy for frustrated customers and acknowledge their feelings
9. NEVER tell customers to "contact support" - they already have!
10. Use TWO line breaks between paragraphs for easy readability

IMPORTANT POLICIES:
- Agents can process refunds, subscription changes, and account modifications
- If suggesting a refund or account change, write it as done: "I've processed your refund"

DOCUMENTATION CONTEXT:
${docsContext}

CONVERSATION HISTORY:
${conversationHistory}

CUSTOMER'S LATEST MESSAGE:
${customerMessage}

Please respond with a JSON object in this exact format:
{
  "suggestedResponse": "The actual response text starting with ${greeting}...",
  "confidence": 0.95,
  "referencedDocs": ["article names/titles of docs referenced"],
  "referencedUrls": ["actual helpscout doc URLs for agent reference"],
  "reasoning": "Why this response addresses their issue...",
  "responseType": "billing|technical|account|general",
  "notesForAgent": "Any missing documentation, suggested improvements, or important context for the agent. Format documentation gaps as numbered list with line breaks."
}`

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
      
      let result
      try {
        result = JSON.parse(jsonString)
      } catch (parseError: any) {
        console.error('JSON parse error:', parseError.message)
        console.error('Full JSON string:', jsonString)
        
        // Try to fix common JSON issues
        // Replace actual newlines in strings with \n
        jsonString = jsonString.replace(/\n(?=(?:[^"]*"[^"]*")*[^"]*$)/g, '\\n')
          .replace(/\r(?=(?:[^"]*"[^"]*")*[^"]*$)/g, '\\r')
          .replace(/\t(?=(?:[^"]*"[^"]*")*[^"]*$)/g, '\\t')
        
        try {
          result = JSON.parse(jsonString)
        } catch (secondError) {
          console.error('Failed to parse even after cleanup:', secondError)
          throw new Error('Invalid JSON response from Claude')
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
        usageString
      }

    } catch (error: any) {
      console.error('Claude API error:', error.response?.data || error.message)
      console.error('Full error:', JSON.stringify(error.response?.data || error, null, 2))
      
      // Fallback response if Claude fails
      return {
        suggestedResponse: "I'd be happy to help you with this issue. Let me look into this and get back to you shortly.",
        confidence: 0.5,
        referencedDocs: [],
        reasoning: "Fallback response due to API error",
        responseType: "general",
        notesForAgent: `Error calling Claude API: ${error.message}`,
        usageString: '💰 Claude Usage: $0.0000 for this request (API call failed)'
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