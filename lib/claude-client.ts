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

IMPORTANT POLICIES:
- Agents can process refunds, subscription changes, and account modifications
- If suggesting a refund or account change, write it as done: "I've processed your refund"

DOCUMENTATION CONTEXT:
${docsContext}

CONVERSATION HISTORY:
${conversationHistory}

CUSTOMER'S LATEST MESSAGE:
${customerMessage}

Please respond with a JSON object in this exact format. IMPORTANT: Use \\n for line breaks within JSON string values, not actual newlines:
{
  "suggestedResponse": "The actual response text starting with ${greeting}... Use \\n\\n for paragraph breaks",
  "confidence": 0.95,
  "referencedDocs": ["article names/titles of docs referenced"],
  "referencedUrls": ["actual helpscout doc URLs for agent reference"],
  "reasoning": "Why this response addresses their issue...",
  "responseType": "billing|technical|account|general",
  "notesForAgent": "Any missing documentation, suggested improvements, or important context for the agent. Use \\n for line breaks."
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
        
        // Try to fix common JSON issues - more robust approach
        console.error('Bad character at position 38:', jsonString.charCodeAt(38), jsonString.charAt(38))
        console.error('Context around position 38:', jsonString.substring(30, 50))
        
        // First, escape all control characters
        let fixedJson = jsonString.replace(/[\x00-\x1F\x7F]/g, (char) => {
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
            
            // Use a more flexible regex that handles multiline content
            const responseMatch = jsonString.match(/"suggestedResponse":\s*"((?:[^"\\]|\\.)*)"/s)
            const suggestedResponse = responseMatch?.[1] || ''
            
            const confidenceMatch = jsonString.match(/"confidence":\s*([\d.]+)/)
            const confidence = parseFloat(confidenceMatch?.[1] || '0.5')
            
            const typeMatch = jsonString.match(/"responseType":\s*"([^"]*)"/)
            const responseType = typeMatch?.[1] || 'general'
            
            const reasoningMatch = jsonString.match(/"reasoning":\s*"((?:[^"\\]|\\.)*)"/s)
            const reasoning = reasoningMatch?.[1]?.replace(/\\n/g, '\n') || 'Response generated successfully'
            
            const notesMatch = jsonString.match(/"notesForAgent":\s*"((?:[^"\\]|\\.)*)"/s)
            const notesForAgent = notesMatch?.[1]?.replace(/\\n/g, '\n') || ''
            
            // Extract arrays
            let referencedDocs: string[] = []
            let referencedUrls: string[] = []
            
            const docsMatch = jsonString.match(/"referencedDocs":\s*\[(.*?)\]/s)
            if (docsMatch) {
              referencedDocs = docsMatch[1].match(/"([^"]*)"/g)?.map(s => s.replace(/"/g, '')) || []
            }
            
            const urlsMatch = jsonString.match(/"referencedUrls":\s*\[(.*?)\]/s)
            if (urlsMatch) {
              referencedUrls = urlsMatch[1].match(/"([^"]*)"/g)?.map(s => s.replace(/"/g, '')) || []
            }
            
            result = {
              suggestedResponse: suggestedResponse.replace(/\\n/g, '\n'),
              confidence,
              referencedDocs,
              referencedUrls,
              reasoning,
              responseType,
              notesForAgent
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
        referencedUrls: [],
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