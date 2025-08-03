import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'
import { SentimentAnalyzer } from '../../lib/sentiment-analyzer'

function createAnalysisNote(sentiment: any, conversation: any): string {
  const triggers = []
  
  if (sentiment.indicators.hasProfanity) {
    triggers.push('🤬 Profanity detected')
  }
  
  if (sentiment.indicators.refundMentions > 0) {
    triggers.push('💰 Refund/cancellation request')
  }
  
  if (sentiment.indicators.urgencyKeywords.length > 0) {
    triggers.push(`⚡ Urgent: ${sentiment.indicators.urgencyKeywords.join(', ')}`)
  }
  
  if (sentiment.indicators.capsRatio > 0.3) {
    triggers.push('📢 High capitalization (shouting)')
  }
  
  const issue = conversation.preview || conversation.subject || 'No preview available'
  
  return `🚨 ANGRY CUSTOMER DETECTED (Score: ${sentiment.score}/100)

📋 Issue Summary:
${issue}

🎯 Triggers Detected:
${triggers.join('\n')}

⏰ Tagged by automation at ${new Date().toLocaleString()}

Please prioritize this customer for immediate response.`
}

interface AngryCustomer {
  conversationId: number
  customerEmail: string
  subject: string
  preview: string
  angerScore: number
  indicators: any
  createdAt: string
  tagged: boolean
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
    let taggedCount = 0
    
    // Analyze each conversation
    for (const conversation of conversations) {
      // Skip if already tagged
      const existingTags = conversation.tags || []
      if (existingTags.includes('angry-customer')) {
        continue
      }
      
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
      
      // If anger score is high, tag the conversation
      if (sentiment.score >= 50) {
        let tagged = false
        
        try {
          await client.addTag(conversation.id, 'angry-customer')
          
          // Create a note with the analysis
          const noteText = createAnalysisNote(sentiment, conversation)
          await client.addNote(conversation.id, noteText)
          
          tagged = true
          taggedCount++
          console.log(`Tagged conversation ${conversation.id} with anger score ${sentiment.score}`)
        } catch (error) {
          console.error(`Failed to tag conversation ${conversation.id}:`, error)
        }
        
        angryCustomers.push({
          conversationId: conversation.id,
          customerEmail: conversation.primaryCustomer?.email || 'Unknown',
          subject: conversation.subject || 'No subject',
          preview: conversation.preview || '',
          angerScore: sentiment.score,
          indicators: sentiment.indicators,
          createdAt: conversation.createdAt,
          tagged
        })
      }
    }
    
    // Sort by anger score (highest first)
    angryCustomers.sort((a, b) => b.angerScore - a.angerScore)
    
    res.status(200).json({
      success: true,
      scannedCount: conversations.length,
      angryCount: angryCustomers.length,
      taggedCount,
      angryCustomers: angryCustomers.slice(0, 10), // Top 10
      message: `Tagged ${taggedCount} conversations as angry customers`,
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