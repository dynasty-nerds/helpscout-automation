import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'
import { SentimentAnalyzer } from '../../lib/sentiment-analyzer'

import { SentimentResult } from '../../lib/sentiment-analyzer'

function createSpamNote(sentiment: SentimentResult, text: string): string {
  const reasons = []
  
  // Check which spam indicators were found
  const lowerText = text.toLowerCase()
  
  if (lowerText.includes('guest post')) {
    reasons.push('- Requesting guest post opportunity')
  }
  if (lowerText.includes('sponsored post') || lowerText.includes('sponsored content')) {
    reasons.push('- Requesting sponsored content')
  }
  if (lowerText.includes('article contribution') || lowerText.includes('post my article')) {
    reasons.push('- Wants to contribute/post articles')
  }
  if (lowerText.includes('dofollow') || lowerText.includes('backlink')) {
    reasons.push('- SEO link building request')
  }
  if (lowerText.includes('tell me the price') || lowerText.includes('what is the cost')) {
    reasons.push('- Asking for advertising prices')
  }
  if (lowerText.includes('editorial team')) {
    reasons.push('- Generic "editorial team" greeting')
  }
  
  return `🗑️ SPAM DETECTED

Reasons:
${reasons.join('\n')}

Total spam indicators found: ${sentiment.indicators.spamIndicatorCount}`
}

function createAnalysisNote(sentiment: SentimentResult, conversation: any): string {
  const parts = []
  
  // Header based on type
  if (sentiment.isAngry) {
    parts.push(`⚠️ ANGRY CUSTOMER DETECTED (Score: ${sentiment.angerScore}/100)`)
  } else {
    parts.push(`🚨 HIGH URGENCY CUSTOMER DETECTED (Score: ${sentiment.urgencyScore}/100)`)
  }
  
  // Issue category
  const categoryMap = {
    'refund-cancellation': 'Refund/Cancellation Request',
    'bug-broken': 'Bug/Broken Functionality',
    'spam': 'Spam',
    'other': 'Other'
  }
  parts.push(`\nCategory: ${categoryMap[sentiment.issueCategory]}`)
  
  // Triggers detected section
  parts.push('\nTriggers Detected:')
  
  if (sentiment.indicators.hasProfanity) {
    parts.push(`- Profanity Detected (${sentiment.indicators.profanityCount} instances)`)
    sentiment.indicators.profanityFound.forEach(quote => {
      parts.push(`  ${quote}`)
    })
  }
  
  if (sentiment.indicators.hasNegativeWords) {
    const total = sentiment.indicators.negativeWordCount + sentiment.indicators.negativeContextCount
    parts.push(`- Negative Sentiment Words Detected (${total} instances)`)
    
    // Show negative context quotes if criticizing service
    if (sentiment.indicators.negativeContextCount > 0) {
      sentiment.indicators.negativeContextFound.forEach(quote => {
        parts.push(`  ${quote}`)
      })
    }
    
    // Show other negative words if not too many
    if (sentiment.indicators.negativeWordCount > 0 && sentiment.indicators.negativeWordsFound.length <= 3) {
      sentiment.indicators.negativeWordsFound.forEach(quote => {
        parts.push(`  ${quote}`)
      })
    }
  }
  
  if (sentiment.indicators.urgencyKeywords.length > 0) {
    parts.push(`- Urgency Keywords: ${sentiment.indicators.urgencyKeywords.join(', ')}`)
  }
  
  if (sentiment.indicators.subscriptionMentions > 0) {
    parts.push(`- Subscription/Billing Issues Mentioned`)
  }
  
  if (sentiment.indicators.capsRatio > 0.3) {
    parts.push(`- High Capitalization (${Math.round(sentiment.indicators.capsRatio * 100)}%)`)
  }
  
  // Suggested response placeholder
  parts.push('\nSuggested Response:')
  parts.push('This functionality is not yet deployed.')
  
  return parts.join('\n')
}

interface UrgentTicket {
  conversationId: number
  customerEmail: string
  subject: string
  preview: string
  urgencyScore: number
  angerScore: number
  categories: string[]
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
    
    const urgentTickets: UrgentTicket[] = []
    let taggedCount = 0
    
    // TESTING: Only process specific conversations
    const testConversationIds = [3014322028, 3023809608];
    
    // Analyze each conversation
    for (const conversation of conversations) {
      // Skip all conversations except our test ones
      if (!testConversationIds.includes(conversation.id)) {
        continue;
      }
      // Check existing tags - ensure they are strings
      const rawTags = conversation.tags || []
      const existingTags = rawTags.map((tag: any) => String(tag))
      const hasUrgencyTag = existingTags.includes('high-urgency')
      const hasAngryTag = existingTags.includes('angry-customer')
      
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
      
      // Process if high urgency OR angry OR spam
      if (sentiment.isHighUrgency || sentiment.isAngry || sentiment.isSpam) {
        let tagged = false
        let isEscalation = false
        
        try {
          // Handle tags based on what's needed
          if (sentiment.isHighUrgency && !hasUrgencyTag && !sentiment.isSpam) {
            // Add high-urgency tag
            await client.addTag(conversation.id, 'high-urgency')
            tagged = true
          }
          
          if (sentiment.isAngry && !hasAngryTag && !sentiment.isSpam) {
            // Add angry-customer tag
            await client.addTag(conversation.id, 'angry-customer')
            tagged = true
          }
          
          // Add note only if we tagged something AND haven't already added an automated note
          if (tagged && !hasUrgencyTag && !hasAngryTag) {
            // Check if we've already added an automated note
            const hasAutomatedNote = existingTags.includes('automated-note-added')
            
            if (!hasAutomatedNote) {
              const noteText = createAnalysisNote(sentiment, conversation)
              await client.addNote(conversation.id, noteText)
              
              // Tag to track that we've added a note
              await client.addTag(conversation.id, 'automated-note-added')
              
              taggedCount++
              console.log(`Tagged ticket ${conversation.id} - Urgent: ${sentiment.isHighUrgency}, Angry: ${sentiment.isAngry}`)
            }
          } else if (sentiment.isSpam && !existingTags.includes('spam')) {
            // Tag as spam
            await client.addTag(conversation.id, 'spam')
            
            // Check if we've already added an automated note
            const hasAutomatedNote = existingTags.includes('automated-note-added')
            
            if (!hasAutomatedNote) {
              // Create spam note
              const spamNote = createSpamNote(sentiment, textToAnalyze)
              await client.addNote(conversation.id, spamNote)
              
              // Tag to track that we've added a note
              await client.addTag(conversation.id, 'automated-note-added')
            }
            
            tagged = true
            taggedCount++
            console.log(`Tagged SPAM ${conversation.id}`)
          }
          // If scores are same or lower, do nothing
        } catch (error) {
          console.error(`Failed to process conversation ${conversation.id}:`, error)
        }
        
        urgentTickets.push({
          conversationId: conversation.id,
          customerEmail: conversation.primaryCustomer?.email || 'Unknown',
          subject: conversation.subject || 'No subject',
          preview: conversation.preview || '',
          urgencyScore: sentiment.urgencyScore,
          angerScore: sentiment.angerScore,
          categories: sentiment.categories,
          indicators: sentiment.indicators,
          createdAt: conversation.createdAt,
          tagged
        })
      }
    }
    
    // Sort by urgency score first, then anger score
    urgentTickets.sort((a, b) => {
      if (b.urgencyScore !== a.urgencyScore) {
        return b.urgencyScore - a.urgencyScore
      }
      return b.angerScore - a.angerScore
    })
    
    const escalationCount = 0 // Removed escalation tracking
    const newUrgentCount = urgentTickets.filter(t => t.tagged).length
    const angryCount = urgentTickets.filter(t => t.angerScore >= 40).length
    const politeUrgentCount = urgentTickets.filter(t => t.categories.includes('polite') && t.categories.includes('urgent')).length
    const spamCount = urgentTickets.filter(t => t.categories.includes('spam')).length
    
    res.status(200).json({
      success: true,
      scannedCount: conversations.length,
      urgentCount: urgentTickets.length,
      newUrgentCount,
      escalationCount,
      angryCount,
      politeUrgentCount,
      spamCount,
      taggedCount,
      urgentTickets: urgentTickets.slice(0, 10), // Top 10
      message: `Tagged ${newUrgentCount} urgent, ${spamCount} spam, ${escalationCount} escalations`,
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