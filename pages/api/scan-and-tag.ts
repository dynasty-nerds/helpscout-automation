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
  previousUrgencyScore?: number
  previousAngerScore?: number
  categories: string[]
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
    
    const urgentTickets: UrgentTicket[] = []
    let taggedCount = 0
    
    // Analyze each conversation
    for (const conversation of conversations) {
      // Check existing tags - ensure they are strings
      const rawTags = conversation.tags || []
      const existingTags = rawTags.map((tag: any) => String(tag))
      const hasUrgencyTag = existingTags.includes('high-urgency')
      const hasAngryTag = existingTags.includes('angry')
      
      // Look for previous scores in tags
      let previousUrgencyScore = 0
      let previousAngerScore = 0
      const urgencyScoreTag = existingTags.find((tag: string) => tag.startsWith('urgency-score-'))
      const angerScoreTag = existingTags.find((tag: string) => tag.startsWith('anger-score-'))
      
      if (urgencyScoreTag) {
        previousUrgencyScore = parseInt(urgencyScoreTag.replace('urgency-score-', ''))
      }
      if (angerScoreTag) {
        previousAngerScore = parseInt(angerScoreTag.replace('anger-score-', ''))
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
      
      // Process if high urgency OR angry OR spam
      if (sentiment.isHighUrgency || sentiment.isAngry || sentiment.isSpam) {
        let tagged = false
        let isEscalation = false
        
        try {
          // Handle tags based on new vs escalation
          if (!hasUrgencyTag && !sentiment.isSpam) {
            // New high urgency ticket (not spam)
            await client.addTag(conversation.id, 'high-urgency')
            await client.addTag(conversation.id, `urgency-score-${sentiment.urgencyScore}`)
            
            if (sentiment.isAngry) {
              await client.addTag(conversation.id, 'angry')
              await client.addTag(conversation.id, `anger-score-${sentiment.angerScore}`)
            }
            
            const noteText = createAnalysisNote(sentiment, conversation)
            await client.addNote(conversation.id, noteText)
            
            tagged = true
            taggedCount++
            console.log(`Tagged NEW urgent ticket ${conversation.id} - Urgency: ${sentiment.urgencyScore}, Anger: ${sentiment.angerScore}`)
          } else if (sentiment.isSpam && !existingTags.includes('spam')) {
            // Tag as spam
            await client.addTag(conversation.id, 'spam')
            
            // Create spam note
            const spamNote = createSpamNote(sentiment, textToAnalyze)
            await client.addNote(conversation.id, spamNote)
            
            tagged = true
            taggedCount++
            console.log(`Tagged SPAM ${conversation.id}`)
          } else if (sentiment.urgencyScore > previousUrgencyScore || sentiment.angerScore > previousAngerScore) {
            // Escalation detected
            isEscalation = true
            
            // Update score tags
            await client.addTag(conversation.id, `urgency-score-${sentiment.urgencyScore}`)
            
            if (sentiment.isAngry) {
              if (!hasAngryTag) await client.addTag(conversation.id, 'angry')
              await client.addTag(conversation.id, `anger-score-${sentiment.angerScore}`)
            }
            
            const escalationNote = `🔥 ESCALATION DETECTED

Previous scores:
- Urgency: ${previousUrgencyScore}/100
- Anger: ${previousAngerScore}/100

Current scores:
- Urgency: ${sentiment.urgencyScore}/100 ${sentiment.urgencyScore > previousUrgencyScore ? `(+${sentiment.urgencyScore - previousUrgencyScore})` : ''}
- Anger: ${sentiment.angerScore}/100 ${sentiment.angerScore > previousAngerScore ? `(+${sentiment.angerScore - previousAngerScore})` : ''}

${createAnalysisNote(sentiment, conversation)}`
            
            await client.addNote(conversation.id, escalationNote)
            
            tagged = true
            taggedCount++
            console.log(`Escalation for ${conversation.id}: Urgency ${previousUrgencyScore}→${sentiment.urgencyScore}, Anger ${previousAngerScore}→${sentiment.angerScore}`)
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
          previousUrgencyScore: previousUrgencyScore > 0 ? previousUrgencyScore : undefined,
          previousAngerScore: previousAngerScore > 0 ? previousAngerScore : undefined,
          categories: sentiment.categories,
          indicators: sentiment.indicators,
          createdAt: conversation.createdAt,
          tagged,
          isEscalation
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
    
    const escalationCount = urgentTickets.filter(t => t.isEscalation).length
    const newUrgentCount = urgentTickets.filter(t => t.tagged && !t.isEscalation).length
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