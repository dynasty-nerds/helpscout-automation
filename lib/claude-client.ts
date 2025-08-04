import axios from 'axios'

interface ClaudeResponse {
  suggestedResponse: string
  confidence: number
  referencedDocs: string[]
  reasoning: string
  responseType: string
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
    relevantDocs: any[]
  ): Promise<ClaudeResponse> {
    
    // Format documentation for context
    const docsContext = relevantDocs.map(doc => 
      `**${doc.title}**\n${doc.content}\nURL: ${doc.url}\n`
    ).join('\n---\n')

    const systemPrompt = `You are a customer support AI for DynastyNerds, a fantasy football platform. Generate helpful, accurate responses based on our documentation.

INSTRUCTIONS:
1. Generate a helpful response that addresses the customer's specific issue
2. Reference relevant documentation when applicable  
3. Match the friendly, professional tone of our team
4. Keep responses concise but complete
5. If you're not sure about something, say so rather than guessing
6. Always be helpful and empathetic

DOCUMENTATION CONTEXT:
${docsContext}

CONVERSATION HISTORY:
${conversationHistory}

CUSTOMER'S LATEST MESSAGE:
${customerMessage}

Please respond with a JSON object in this exact format:
{
  "suggestedResponse": "The actual response text...",
  "confidence": 0.95,
  "referencedDocs": ["doc1", "doc2"],
  "reasoning": "Why this response addresses their issue...",
  "responseType": "billing|technical|account|general"
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
        reasoning: result.reasoning,
        responseType: result.responseType
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