import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'
import { SentimentAnalyzer } from '../../lib/sentiment-analyzer'

interface AngryExample {
  conversationId: number
  customerEmail: string
  subject: string
  preview: string
  urgencyScore: number
  angerScore: number
  categories: string[]
  indicators: any
  closedAt: string
  notePreview?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const client = new HelpScoutClient()
    const analyzer = new SentimentAnalyzer()
    
    // Get closed conversations
    const conversationsData = await client.getClosedConversations()
    const conversations = conversationsData._embedded?.conversations || []
    
    console.log(`Found ${conversations.length} closed conversations`)
    
    const angryExamples: AngryExample[] = []
    
    // Analyze each conversation
    for (const conversation of conversations) {
      // Combine subject and latest message for analysis
      let textToAnalyze = conversation.subject || ''
      
      // Get the latest customer message from threads
      if (conversation._embedded?.threads) {
        const customerThreads = conversation._embedded.threads.filter(
          (thread: any) => thread.type === 'customer'
        )
        
        if (customerThreads.length > 0) {
          const latestThread = customerThreads[customerThreads.length - 1]
          // Strip HTML tags from body
          const cleanBody = (latestThread.body || '').replace(/<[^>]*>/g, ' ')
          textToAnalyze += ' ' + cleanBody
        }
      }
      
      // Analyze sentiment
      const sentiment = analyzer.analyze(textToAnalyze)
      
      // Look for angry customers
      if (sentiment.isAngry) {
        // Generate what the note would look like
        const notePreview = `😡 ANGRY (Anger: ${sentiment.angerScore}/100, Urgency: ${sentiment.urgencyScore}/100)
Category: ${sentiment.issueCategory}
Triggers: ${sentiment.indicators.hasProfanity ? 'Profanity, ' : ''}${sentiment.indicators.hasNegativeWords ? 'Negative Language, ' : ''}${sentiment.indicators.urgencyKeywords.length > 0 ? 'Urgency Keywords' : ''}`
        
        angryExamples.push({
          conversationId: conversation.id,
          customerEmail: conversation.primaryCustomer?.email || 'Unknown',
          subject: conversation.subject || 'No subject',
          preview: conversation.preview || '',
          urgencyScore: sentiment.urgencyScore,
          angerScore: sentiment.angerScore,
          categories: sentiment.categories,
          indicators: sentiment.indicators,
          closedAt: conversation.closedAt,
          notePreview
        })
      }
    }
    
    // Sort by anger score (highest first)
    angryExamples.sort((a, b) => b.angerScore - a.angerScore)
    
    res.status(200).json({
      success: true,
      scannedCount: conversations.length,
      angryCount: angryExamples.length,
      angryExamples: angryExamples.slice(0, 20), // Top 20
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Scan error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to scan closed conversations',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}