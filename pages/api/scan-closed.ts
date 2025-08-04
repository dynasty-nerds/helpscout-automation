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
    
    console.log('READ-ONLY SCAN - No tags or notes will be added to closed tickets')
    
    // Fetch multiple pages of closed conversations
    const allConversations = []
    const maxPages = 20 // This will get us up to 1000 conversations (50 per page)
    
    for (let page = 1; page <= maxPages; page++) {
      try {
        const conversationsData = await client.getClosedConversations(page)
        const pageConversations = conversationsData._embedded?.conversations || []
        
        if (pageConversations.length === 0) {
          break // No more conversations
        }
        
        allConversations.push(...pageConversations)
        console.log(`Fetched page ${page}, total conversations: ${allConversations.length}`)
        
        // Stop if we have enough
        if (allConversations.length >= 1000) {
          break
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error)
        break
      }
    }
    
    console.log(`Total closed conversations to analyze: ${allConversations.length}`)
    
    const angryExamples: AngryExample[] = []
    
    // Analyze each conversation (READ-ONLY - no modifications)
    for (const conversation of allConversations) {
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
      scannedCount: allConversations.length,
      angryCount: angryExamples.length,
      angryExamples: angryExamples.slice(0, 50), // Top 50 examples
      message: `READ-ONLY scan of ${allConversations.length} closed tickets - no modifications made`,
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