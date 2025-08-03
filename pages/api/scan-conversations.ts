import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'
import { SentimentAnalyzer } from '../../lib/sentiment-analyzer'

interface AngryCustomer {
  conversationId: number
  customerEmail: string
  subject: string
  preview: string
  angerScore: number
  indicators: any
  createdAt: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const client = new HelpScoutClient()
    const analyzer = new SentimentAnalyzer()
    
    // Get all active conversations
    const conversationsData = await client.getActiveConversations()
    const conversations = conversationsData._embedded?.conversations || []
    
    console.log(`Found ${conversations.length} active conversations`)
    
    const angryCustomers: AngryCustomer[] = []
    
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
          textToAnalyze += ' ' + (latestThread.body || '')
        }
      }
      
      // Analyze sentiment
      const sentiment = analyzer.analyze(textToAnalyze)
      
      // If anger score is high, add to list
      if (sentiment.score >= 50) {
        angryCustomers.push({
          conversationId: conversation.id,
          customerEmail: conversation.primaryCustomer?.email || 'Unknown',
          subject: conversation.subject || 'No subject',
          preview: conversation.preview || '',
          angerScore: sentiment.score,
          indicators: sentiment.indicators,
          createdAt: conversation.createdAt
        })
      }
    }
    
    // Sort by anger score (highest first)
    angryCustomers.sort((a, b) => b.angerScore - a.angerScore)
    
    // Get mailboxes to find folder IDs
    const mailboxes = await client.getMailboxes()
    const firstMailbox = mailboxes._embedded?.mailboxes?.[0]
    
    res.status(200).json({
      success: true,
      scannedCount: conversations.length,
      angryCount: angryCustomers.length,
      angryCustomers: angryCustomers.slice(0, 10), // Top 10
      mailboxId: firstMailbox?.id,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Scan error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to scan conversations',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}