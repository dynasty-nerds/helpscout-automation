import { NextApiRequest, NextApiResponse } from 'next'
import { ClaudeClient } from '../../lib/claude-client'
import { HelpScoutDocsClient } from '../../lib/helpscout-docs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST with JSON body.' 
    })
  }

  try {
    const { 
      issueDescription, 
      customerName = 'there',
      includeApology = true,
      tone = 'friendly' // friendly, professional, empathetic
    } = req.body

    if (!issueDescription) {
      return res.status(400).json({ 
        success: false, 
        error: 'issueDescription is required in request body' 
      })
    }

    console.log('Generating response for issue:', issueDescription)
    console.log('Customer name:', customerName)

    // Initialize clients
    const claudeClient = new ClaudeClient()
    const docsClient = new HelpScoutDocsClient()

    // Fetch relevant documentation
    const relevantDocs = await docsClient.searchArticles(issueDescription)
    console.log(`Found ${relevantDocs.length} relevant docs`)

    // Build a minimal conversation context
    const conversationContext = `
Customer Issue Description: ${issueDescription}

This is a template response request for a common issue that multiple customers are experiencing.
Generate a friendly, helpful response that can be customized for individual customers.
`

    // Generate the response using Claude
    const greeting = customerName === 'there' ? 'Hey there,' : `Hey ${customerName},`
    
    const systemPrompt = `You are generating a TEMPLATE RESPONSE for DynastyNerds support agents to use with customers experiencing a specific issue.

CRITICAL INSTRUCTIONS:
1. Start with "${greeting}" followed by TWO line breaks
2. Generate a warm, friendly, and helpful response
3. ${includeApology ? 'Include an apology for the inconvenience' : 'Do not include an apology'}
4. Tone should be ${tone}
5. Do NOT use bold text or markdown formatting
6. Use TWO line breaks between paragraphs for readability
7. Do NOT include any closing signature - HelpScout adds this automatically
8. Keep the response concise but complete
9. If the issue involves waiting, provide realistic timeframes
10. Always provide actionable next steps for the customer
11. Base responses on documentation if available, otherwise use best practices

IMPORTANT PRINCIPLES:
- Show empathy for frustrated customers
- Acknowledge the issue clearly
- Provide specific solutions or workarounds
- Set clear expectations about resolution
- Thank customers for their patience when appropriate

The issue to address: ${issueDescription}

Please respond with a JSON object in this exact format:
{
  "suggestedResponse": "The complete response text starting with ${greeting}... Use \\n\\n for paragraph breaks",
  "issueCategory": "Brief 3-5 word category for this issue",
  "recommendedTags": ["suggested", "helpscout", "tags"],
  "keyPoints": ["main points addressed in the response"],
  "confidence": 0.95,
  "responseLength": "short|medium|long"
}`

    const response = await claudeClient.generateTemplateResponse(
      issueDescription,
      systemPrompt,
      relevantDocs
    )

    // Format the final response
    const result = {
      success: true,
      response: response.suggestedResponse,
      metadata: {
        issueCategory: response.issueCategory || 'General Issue',
        recommendedTags: response.recommendedTags || [],
        keyPoints: response.keyPoints || [],
        confidence: response.confidence || 0.9,
        responseLength: response.responseLength || 'medium',
        docsUsed: relevantDocs.map(doc => ({
          name: doc.name,
          url: doc.publicUrl
        })),
        cost: response.cost || 0,
        tokensUsed: {
          input: response.inputTokens || 0,
          output: response.outputTokens || 0
        }
      }
    }

    // Log success
    console.log('Successfully generated response')
    console.log(`Category: ${result.metadata.issueCategory}`)
    console.log(`Confidence: ${result.metadata.confidence}`)
    console.log(`Response length: ${result.response.length} characters`)

    res.status(200).json(result)

  } catch (error: any) {
    console.error('Error generating response:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate response',
      details: error.response?.data || error
    })
  }
}