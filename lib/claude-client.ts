import axios from 'axios'

interface ClaudeResponse {
  suggestedResponse: string
  confidence: number
  referencedDocs: string[]
  referencedUrls?: string[]
  reasoning: string
  responseType: string
  notesForAgent?: string
}

export class ClaudeClient {
  private apiKey: string
  private baseURL = 'https://api.anthropic.com/v1/messages'

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('CLAUDE_API_KEY environment variable is required')
    }
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
1. Start with "${greeting}" to address the customer directly
2. Generate the response AS IF the agent is speaking - they can take actions like processing refunds
3. Use **bold text** for any actions the agent needs to take (e.g., **I've processed your refund**)
4. Be VERY friendly, warm, and conversational in tone
5. Base responses ONLY on the provided documentation - never guess or hallucinate
6. If documentation is missing, note this in the reasoning/notes section, not in the response
7. Do NOT include any closing signature - HelpScout adds this automatically
8. Show empathy for frustrated customers and acknowledge their feelings
9. NEVER tell customers to "contact support" - they already have!

IMPORTANT POLICIES:
- Pre-existing members are grandfathered at their current pricing
- Agents can process refunds, subscription changes, and account modifications
- If suggesting a refund or account change, write it as done: **I've processed your refund**

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
  "notesForAgent": "Any missing documentation, suggested improvements, or important context for the agent"
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

      const result = JSON.parse(jsonMatch[0])
      
      // Log usage for cost tracking
      console.log(`Claude API usage: ${response.data.usage?.input_tokens || 0} input tokens, ${response.data.usage?.output_tokens || 0} output tokens`)
      
      return {
        suggestedResponse: result.suggestedResponse,
        confidence: result.confidence,
        referencedDocs: result.referencedDocs || [],
        referencedUrls: result.referencedUrls || [],
        reasoning: result.reasoning,
        responseType: result.responseType,
        notesForAgent: result.notesForAgent || ''
      }

    } catch (error: any) {
      console.error('Claude API error:', error.response?.data || error.message)
      
      // Fallback response if Claude fails
      return {
        suggestedResponse: "I'd be happy to help you with this issue. Let me look into this and get back to you shortly.",
        confidence: 0.5,
        referencedDocs: [],
        reasoning: "Fallback response due to API error",
        responseType: "general"
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