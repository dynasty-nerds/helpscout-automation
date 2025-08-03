import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'
import { SentimentAnalyzer } from '../../lib/sentiment-analyzer'

function createAnalysisNote(sentiment: any, conversation: any): string {
  const triggers = []
  
  if (sentiment.indicators.hasProfanity) {
    triggers.push(`🤬 Profanity detected (${sentiment.indicators.profanityCount} instances)`)
    sentiment.indicators.profanityFound.forEach(quote => {
      triggers.push(`  └─ ${quote}`)
    })
  }
  
  if (sentiment.indicators.hasNegativeWords) {
    const total = sentiment.indicators.negativeWordCount + sentiment.indicators.negativeContextCount
    triggers.push(`😤 Negative language (${total} instances)`)
    if (sentiment.indicators.negativeContextCount > 0) {
      triggers.push(`  └─ Criticizing service/app/company:`)
      sentiment.indicators.negativeContextFound.forEach(quote => {
        triggers.push(`     • ${quote}`)
      })
    }
    if (sentiment.indicators.negativeWordCount > 0 && sentiment.indicators.negativeWordsFound.length <= 3) {
      sentiment.indicators.negativeWordsFound.forEach(quote => {
        triggers.push(`  └─ ${quote}`)
      })
    }
  }
  
  if (sentiment.indicators.refundMentions > 0) {
    triggers.push('💰 Refund/cancellation request')
  }
  
  if (sentiment.indicators.urgencyKeywords.length > 0) {
    triggers.push(`⚡ Urgent: ${sentiment.indicators.urgencyKeywords.join(', ')}`)
  }
  
  if (sentiment.indicators.capsRatio > 0.3) {
    triggers.push(`📢 High capitalization (${Math.round(sentiment.indicators.capsRatio * 100)}% caps)`)
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
  previousScore?: number
  indicators: any
  createdAt: string
  tagged: boolean
  isEscalation?: boolean
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
      // Check existing tags - we'll still analyze if already tagged to check for escalation
      const existingTags = conversation.tags || []
      const alreadyTagged = existingTags.includes('angry-customer')
      
      // Look for previous anger score in tags (e.g., "anger-score-60")
      let previousScore = 0
      const scoreTag = existingTags.find((tag: string) => tag.startsWith('anger-score-'))
      if (scoreTag) {
        previousScore = parseInt(scoreTag.replace('anger-score-', ''))
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
      
      // If anger score is high, handle tagging and notes
      if (sentiment.score >= 50) {
        let tagged = false
        let isEscalation = false
        
        try {
          // Determine if this is a new angry customer or an escalation
          if (!alreadyTagged) {
            // New angry customer
            await client.addTag(conversation.id, 'angry-customer')
            await client.addTag(conversation.id, `anger-score-${sentiment.score}`)
            
            const noteText = createAnalysisNote(sentiment, conversation)
            await client.addNote(conversation.id, noteText)
            
            tagged = true
            taggedCount++
            console.log(`Tagged NEW angry customer ${conversation.id} with score ${sentiment.score}`)
          } else if (sentiment.score > previousScore) {
            // Escalating anger - update score tag and add new note
            isEscalation = true
            
            // Remove old score tag if exists
            if (scoreTag) {
              // Note: HelpScout doesn't have a remove tag API, so we'll just add the new one
            }
            
            await client.addTag(conversation.id, `anger-score-${sentiment.score}`)
            
            const escalationNote = `🔥 ANGER ESCALATION DETECTED

Previous score: ${previousScore}/100
Current score: ${sentiment.score}/100 (+${sentiment.score - previousScore})

${createAnalysisNote(sentiment, conversation)}`
            
            await client.addNote(conversation.id, escalationNote)
            
            tagged = true
            taggedCount++
            console.log(`Escalation detected for ${conversation.id}: ${previousScore} → ${sentiment.score}`)
          }
          // If score is same or lower, do nothing
        } catch (error) {
          console.error(`Failed to process conversation ${conversation.id}:`, error)
        }
        
        angryCustomers.push({
          conversationId: conversation.id,
          customerEmail: conversation.primaryCustomer?.email || 'Unknown',
          subject: conversation.subject || 'No subject',
          preview: conversation.preview || '',
          angerScore: sentiment.score,
          previousScore: previousScore > 0 ? previousScore : undefined,
          indicators: sentiment.indicators,
          createdAt: conversation.createdAt,
          tagged,
          isEscalation
        })
      }
    }
    
    // Sort by anger score (highest first)
    angryCustomers.sort((a, b) => b.angerScore - a.angerScore)
    
    const escalationCount = angryCustomers.filter(c => c.isEscalation).length
    const newAngryCount = angryCustomers.filter(c => c.tagged && !c.isEscalation).length
    
    res.status(200).json({
      success: true,
      scannedCount: conversations.length,
      angryCount: angryCustomers.length,
      newAngryCount,
      escalationCount,
      taggedCount,
      angryCustomers: angryCustomers.slice(0, 10), // Top 10
      message: `Tagged ${newAngryCount} new angry customers, ${escalationCount} escalations`,
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