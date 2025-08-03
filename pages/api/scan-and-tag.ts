import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'
import { SentimentAnalyzer } from '../../lib/sentiment-analyzer'

function createAnalysisNote(sentiment: any, conversation: any): string {
  const triggers = []
  const categories = sentiment.categories.join(', ')
  
  // Show different header based on type
  let header = '🚨 HIGH URGENCY TICKET'
  if (sentiment.isAngry) {
    header = '🔥 ANGRY CUSTOMER - HIGH URGENCY'
  } else if (sentiment.categories.includes('subscription-related')) {
    header = '💰 SUBSCRIPTION ISSUE - HIGH URGENCY'
  }
  
  // Detail the urgency reasons
  if (sentiment.indicators.subscriptionMentions > 0) {
    triggers.push(`💳 Subscription/billing issue (${sentiment.indicators.subscriptionMentions} mentions)`)
  }
  
  if (sentiment.indicators.urgencyKeywords.length > 0) {
    triggers.push(`⚡ Urgent keywords: ${sentiment.indicators.urgencyKeywords.join(', ')}`)
  }
  
  // Only show anger indicators if actually angry
  if (sentiment.isAngry) {
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
    }
    
    if (sentiment.indicators.capsRatio > 0.3) {
      triggers.push(`📢 High capitalization (${Math.round(sentiment.indicators.capsRatio * 100)}% caps)`)
    }
  }
  
  // Note if they're being polite despite issues
  if (sentiment.indicators.isPoliteRequest) {
    triggers.push('🤝 Customer is being polite')
  }
  
  const issue = conversation.preview || conversation.subject || 'No preview available'
  
  return `${header}

📋 Issue Summary:
${issue}

📊 Analysis:
- Urgency Score: ${sentiment.urgencyScore}/100
- Anger Score: ${sentiment.angerScore}/100
- Categories: ${categories}

🎯 Reasons for Priority:
${triggers.join('\n')}

⏰ Tagged by automation at ${new Date().toLocaleString()}

Please prioritize this customer for immediate response.`
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
      // Check existing tags
      const existingTags = conversation.tags || []
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
      
      // Process if high urgency OR angry
      if (sentiment.isHighUrgency || sentiment.isAngry) {
        let tagged = false
        let isEscalation = false
        
        try {
          // Handle tags based on new vs escalation
          if (!hasUrgencyTag) {
            // New high urgency ticket
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
    
    res.status(200).json({
      success: true,
      scannedCount: conversations.length,
      urgentCount: urgentTickets.length,
      newUrgentCount,
      escalationCount,
      angryCount,
      politeUrgentCount,
      taggedCount,
      urgentTickets: urgentTickets.slice(0, 10), // Top 10
      message: `Tagged ${newUrgentCount} new urgent tickets (${angryCount} angry, ${politeUrgentCount} polite), ${escalationCount} escalations`,
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