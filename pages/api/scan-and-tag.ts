import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'
import { SentimentAnalyzer } from '../../lib/sentiment-analyzer'
import { TeamsClient } from '../../lib/teams-client'
import { ClaudeClient } from '../../lib/claude-client'
import { HelpScoutDocsClient } from '../../lib/helpscout-docs'
import fs from 'fs/promises'
import path from 'path'

import { SentimentResult } from '../../lib/sentiment-analyzer'

async function loadLearningFiles(): Promise<{ learnings: string; gaps: string }> {
  try {
    const learningsPath = path.join(process.cwd(), 'claude-learnings.md')
    const gapsPath = path.join(process.cwd(), 'documentation-gaps.md')
    
    let learnings = ''
    let gaps = ''
    
    try {
      learnings = await fs.readFile(learningsPath, 'utf-8')
    } catch (error) {
      // Create empty learnings file if it doesn't exist
      learnings = '# Claude Learning File\n\nThis file tracks learnings from agent responses to improve future AI suggestions.\n\n## Learnings\n\n'
      await fs.writeFile(learningsPath, learnings, 'utf-8')
    }
    
    try {
      gaps = await fs.readFile(gapsPath, 'utf-8')
    } catch (error) {
      // Create empty gaps file if it doesn't exist
      gaps = '# Documentation Gaps\n\nThis file tracks areas where documentation needs improvement.\n\n## Gaps Identified\n\n'
      await fs.writeFile(gapsPath, gaps, 'utf-8')
    }
    
    return { learnings, gaps }
  } catch (error) {
    console.error('Error loading learning files:', error)
    return { learnings: '', gaps: '' }
  }
}

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
  
  // Determine confidence level based on indicator count
  let confidence = 'Low'
  if (sentiment.indicators.spamIndicatorCount >= 4) {
    confidence = 'High'
  } else if (sentiment.indicators.spamIndicatorCount >= 2) {
    confidence = 'Medium'
  }
  
  return `📝 Guest post/SEO spam request
🗑️ SPAM DETECTED (${confidence} confidence)

Reasons:
${reasons.join('\n')}

Total spam indicators found: ${sentiment.indicators.spamIndicatorCount}`
}

interface AnalysisResult {
  noteText: string
  suggestedResponse?: string
  hasAIResponse: boolean
  aiSentiment?: {
    angerScore: number
    urgencyScore: number
    isAngry: boolean
    isHighUrgency: boolean
    isSpam: boolean
  }
}

async function createAnalysisNote(
  keywordSentiment: SentimentResult, 
  conversation: any, 
  claudeClient?: ClaudeClient | null,
  docsClient?: HelpScoutDocsClient | null
): Promise<AnalysisResult> {
  const parts = []
  
  // Create a concise issue summary (3-10 words)
  let issueSummary = '📝 '
  
  // Get the actual message content for better summary
  let messageContent = ''
  if (conversation._embedded?.threads) {
    const customerThreads = conversation._embedded.threads.filter(
      (thread: any) => thread.type === 'customer'
    )
    if (customerThreads.length > 0) {
      const latestThread = customerThreads[customerThreads.length - 1]
      messageContent = (latestThread.body || '').replace(/<[^>]*>/g, ' ').toLowerCase()
    }
  }
  
  const subject = (conversation.subject || '').toLowerCase()
  const combinedText = subject + ' ' + messageContent
  
  // We'll use the keywordSentiment for initial categorization
  // AI sentiment will override these values when the response is generated
  let sentiment = keywordSentiment // Use keyword sentiment as fallback
  
  // Generate summary based on issue category and content
  if (sentiment.issueCategory === 'refund-cancellation') {
    if (combinedText.includes('cancel')) {
      issueSummary += 'Wants to cancel subscription'
    } else if (combinedText.includes('refund')) {
      issueSummary += 'Requesting refund'
    } else {
      issueSummary += 'Billing/subscription issue'
    }
  } else if (sentiment.issueCategory === 'bug-broken') {
    if (combinedText.includes('not working')) {
      issueSummary += 'Feature not working'
    } else if (combinedText.includes('error')) {
      issueSummary += 'Error with app'
    } else if (combinedText.includes('bug')) {
      issueSummary += 'Bug report'
    } else {
      issueSummary += 'Technical issue reported'
    }
  } else if (sentiment.issueCategory === 'spam') {
    issueSummary = '📝 Spam/promotional request'
  } else {
    // Look for specific keywords in the actual message content
    if (combinedText.includes('sync') && (combinedText.includes('rtsports') || combinedText.includes('rt sports'))) {
      issueSummary += 'RTSports sync question'
    } else if (combinedText.includes('sync') && combinedText.includes('league')) {
      issueSummary += 'League sync issue'
    } else if (combinedText.includes('import')) {
      issueSummary += 'Import issue'
    } else if (combinedText.includes('export')) {
      issueSummary += 'Export request'
    } else if (combinedText.includes('help')) {
      issueSummary += 'Needs help'
    } else if (combinedText.includes('question')) {
      issueSummary += 'Has question'
    } else if (combinedText.includes('access')) {
      issueSummary += 'Access issue'
    } else if (combinedText.includes('login') || combinedText.includes('log in')) {
      issueSummary += 'Login problem'
    } else if (combinedText.includes('password')) {
      issueSummary += 'Password issue'
    } else if (combinedText.includes('subscription')) {
      issueSummary += 'Subscription question'
    } else if (combinedText.includes('dynasty') || combinedText.includes('league')) {
      issueSummary += 'League question'
    } else if (combinedText.includes('trade')) {
      issueSummary += 'Trade question'
    } else if (combinedText.includes('draft')) {
      issueSummary += 'Draft question'
    } else if (subject.length > 0) {
      // Use subject but remove "Re:" prefix
      let cleanSubject = conversation.subject
      if (cleanSubject.toLowerCase().startsWith('re:')) {
        cleanSubject = cleanSubject.substring(3).trim()
      }
      const words = cleanSubject.split(' ').slice(0, 5).join(' ')
      issueSummary += words.length > 30 ? words.substring(0, 30) + '...' : words
    } else if (messageContent.length > 0) {
      // Extract first meaningful words from message
      const words = messageContent.trim().split(/\s+/).slice(0, 5).join(' ')
      issueSummary += words.length > 30 ? words.substring(0, 30) + '...' : words
    } else {
      issueSummary += 'General inquiry'
    }
  }
  
  // Header based on type with both scores
  let header = ''
  if (sentiment.isAngry) {
    header = `😡 ANGRY (Anger: ${sentiment.angerScore}/100, Urgency: ${sentiment.urgencyScore}/100)`
  } else if (sentiment.isHighUrgency) {
    header = `❗ HIGH URGENCY (Urgency: ${sentiment.urgencyScore}/100, Anger: ${sentiment.angerScore}/100)`
  } else {
    // For non-urgent tickets, use 💬 emoji
    header = `💬 STANDARD (Urgency: ${sentiment.urgencyScore}/100, Anger: ${sentiment.angerScore}/100)`
  }
  
  // Add summary and header
  parts.push(issueSummary)
  parts.push(header)
  
  // Issue category
  const categoryMap = {
    'refund-cancellation': 'Refund/Cancellation Request',
    'bug-broken': 'Bug/Broken Functionality',
    'spam': 'Spam',
    'other': 'Other'
  }
  parts.push(`\nCategory: ${categoryMap[sentiment.issueCategory]}`)
  
  // Triggers detected section - only show if there are triggers
  const hasAnyTriggers = sentiment.indicators.hasProfanity || 
                        sentiment.indicators.hasNegativeWords || 
                        sentiment.indicators.urgencyKeywords.length > 0 || 
                        sentiment.indicators.subscriptionMentions > 0 || 
                        sentiment.indicators.capsRatio > 0.3
  
  if (hasAnyTriggers) {
    parts.push('\nTriggers Detected:')
  
  // Combine profanity and negative sentiment into one section
  if (sentiment.indicators.hasProfanity || sentiment.indicators.hasNegativeWords) {
    const hasActualProfanity = sentiment.indicators.hasProfanity
    const hasNegativeSentiment = sentiment.indicators.negativeContextCount > 0 || sentiment.indicators.negativeWordCount > 0
    
    if (hasActualProfanity && hasNegativeSentiment) {
      parts.push(`- Profanity & Negative Language Detected`)
    } else if (hasActualProfanity) {
      parts.push(`- Profanity Detected (${sentiment.indicators.profanityCount} instances)`)
    } else {
      parts.push(`- Negative Language Detected`)
    }
    
    // Show profanity quotes
    if (sentiment.indicators.hasProfanity) {
      sentiment.indicators.profanityFound.forEach(quote => {
        parts.push(`  ${quote}`)
      })
    }
    
    // Show negative context quotes if criticizing service
    if (sentiment.indicators.negativeContextCount > 0) {
      sentiment.indicators.negativeContextFound.forEach(quote => {
        parts.push(`  ${quote}`)
      })
    }
    
    // Show other negative words if not too many and no profanity
    if (!hasActualProfanity && sentiment.indicators.negativeWordCount > 0 && sentiment.indicators.negativeWordsFound.length <= 3) {
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
  } // Close hasAnyTriggers check
  
  // Generate AI suggested response
  let suggestedResponse: string | undefined
  let hasAIResponse = false
  
  if (claudeClient && docsClient) {
    console.log(`Generating AI response for conversation ${conversation.id}`)
    try {
      // Get customer message from latest thread
      let customerMessage = conversation.subject || ''
      if (conversation._embedded?.threads) {
        const customerThreads = conversation._embedded.threads.filter(
          (thread: any) => thread.type === 'customer'
        )
        if (customerThreads.length > 0) {
          const latestThread = customerThreads[customerThreads.length - 1]
          customerMessage = (latestThread.body || '').replace(/<[^>]*>/g, ' ')
        }
      }
      
      // Get relevant documentation
      const cachedArticles = await docsClient.getCachedArticles()
      const relevantDocs = docsClient.findRelevantArticles(customerMessage, cachedArticles, 3)
      
      // Load learning files for context
      const { learnings, gaps } = await loadLearningFiles()
      
      // Build conversation history context
      let conversationHistory = `Subject: ${conversation.subject || 'No subject'}\n`
      if (conversation._embedded?.threads) {
        conversation._embedded.threads.forEach((thread: any) => {
          if (thread.type === 'customer') {
            const cleanBody = (thread.body || '').replace(/<[^>]*>/g, ' ')
            conversationHistory += `\nCustomer: ${cleanBody}\n`
          }
        })
      }
      
      // Add learnings and gaps as context to relevant docs
      const contextDocs = [
        ...relevantDocs,
        {
          title: 'Agent Learning Insights',
          content: learnings,
          url: 'internal://learnings'
        },
        {
          title: 'Known Documentation Gaps',
          content: gaps,
          url: 'internal://gaps'
        }
      ]
      
      // Get customer first name
      console.log(`Primary customer data:`, JSON.stringify(conversation.primaryCustomer || {}, null, 2))
      let customerFirstName = conversation.primaryCustomer?.firstName || conversation.primaryCustomer?.first || undefined
      
      // Capitalize first letter of name
      if (customerFirstName && typeof customerFirstName === 'string') {
        customerFirstName = customerFirstName.charAt(0).toUpperCase() + customerFirstName.slice(1).toLowerCase()
      }
      
      // Generate AI response
      console.log(`Calling Claude API for conversation ${conversation.id}`)
      console.log(`Customer message preview: ${customerMessage ? customerMessage.substring(0, 100) + '...' : 'No message'}`)
      console.log(`Found ${relevantDocs.length} relevant docs`)
      const aiResponse = await claudeClient.generateResponse(
        customerMessage,
        conversationHistory,
        contextDocs,
        customerFirstName
      )
      console.log(`AI response generated for conversation ${conversation.id}: ${aiResponse.suggestedResponse ? aiResponse.suggestedResponse.substring(0, 50) + '...' : 'No response'}`)
      
      // Use AI sentiment scores if available
      if (aiResponse.angerScore !== undefined && aiResponse.urgencyScore !== undefined) {
        console.log(`\n🤖 === AI SENTIMENT ANALYSIS COMPARISON ===`)
        console.log(`📊 AI Sentiment Scores    - Anger: ${aiResponse.angerScore}/100, Urgency: ${aiResponse.urgencyScore}/100`)
        console.log(`🔍 Keyword Scores        - Anger: ${keywordSentiment.angerScore}/100, Urgency: ${keywordSentiment.urgencyScore}/100`)
        console.log(`📈 Difference            - Anger: ${(aiResponse.angerScore || 0) > keywordSentiment.angerScore ? '+' : ''}${(aiResponse.angerScore || 0) - keywordSentiment.angerScore}, Urgency: ${(aiResponse.urgencyScore || 0) > keywordSentiment.urgencyScore ? '+' : ''}${(aiResponse.urgencyScore || 0) - keywordSentiment.urgencyScore}`)
        console.log(`🎯 AI Triggers:`)
        console.log(`   - Anger: ${aiResponse.angerTriggers?.join(', ') || 'none'}`)
        console.log(`   - Urgency: ${aiResponse.urgencyTriggers?.join(', ') || 'none'}`)
        console.log(`💡 AI Reasoning: ${aiResponse.sentimentReasoning || 'No reasoning provided'}`)
        console.log(`=====================================\n`)
        
        // Override the header with AI sentiment scores
        const aiSentiment = {
          angerScore: aiResponse.angerScore || 0,
          urgencyScore: aiResponse.urgencyScore || 0,
          isAngry: (aiResponse.angerScore || 0) >= 40,
          isHighUrgency: (aiResponse.urgencyScore || 0) >= 60,
          isSpam: aiResponse.isSpam || false
        }
        
        // Update header based on AI scores
        let aiHeader = ''
        if (aiSentiment.isAngry) {
          aiHeader = `😡 ANGRY (Anger: ${aiSentiment.angerScore}/100, Urgency: ${aiSentiment.urgencyScore}/100)`
        } else if (aiSentiment.isHighUrgency) {
          aiHeader = `❗ HIGH URGENCY (Urgency: ${aiSentiment.urgencyScore}/100, Anger: ${aiSentiment.angerScore}/100)`
        } else {
          aiHeader = `💬 STANDARD (Urgency: ${aiSentiment.urgencyScore}/100, Anger: ${aiSentiment.angerScore}/100)`
        }
        
        // Replace the header in parts array
        parts[1] = aiHeader
        
        // Add AI sentiment analysis details
        if (aiResponse.sentimentReasoning) {
          parts.splice(2, 0, `\n🤖 AI Sentiment Analysis: ${aiResponse.sentimentReasoning}`)
        }
        
        // Replace triggers section with AI triggers if available
        if (aiResponse.angerTriggers && aiResponse.angerTriggers.length > 0) {
          const triggersIndex = parts.findIndex(p => p.includes('Triggers Detected:'))
          if (triggersIndex >= 0) {
            // Remove old triggers section
            let i = triggersIndex
            while (i < parts.length && !parts[i].startsWith('\n')) {
              parts.splice(i, 1)
            }
            
            // Add new AI-based triggers
            parts.splice(triggersIndex, 0, '\nAI-Detected Triggers:')
            if (aiResponse.angerTriggers.length > 0) {
              parts.splice(triggersIndex + 1, 0, `- Anger Triggers: ${aiResponse.angerTriggers.join(', ')}`)
            }
            if (aiResponse.urgencyTriggers && aiResponse.urgencyTriggers.length > 0) {
              parts.splice(triggersIndex + 2, 0, `- Urgency Triggers: ${aiResponse.urgencyTriggers.join(', ')}`)
            }
          }
        }
        
        // Update sentiment object for return value
        sentiment = {
          ...sentiment,
          angerScore: aiSentiment.angerScore,
          urgencyScore: aiSentiment.urgencyScore,
          isAngry: aiSentiment.isAngry,
          isHighUrgency: aiSentiment.isHighUrgency,
          isSpam: aiSentiment.isSpam
        }
      }
      
      // Store the suggested response separately
      suggestedResponse = aiResponse.suggestedResponse
      hasAIResponse = !!aiResponse.suggestedResponse
      
      if (hasAIResponse) {
        parts.push(`\n✅ AI Draft Reply Created [Confidence: ${Math.round(aiResponse.confidence * 100)}% | Type: ${aiResponse.responseType}]`)
      } else {
        parts.push(`\n❌ AI Draft Reply Failed - Manual response needed`)
      }
      
      if (aiResponse.reasoning) {
        parts.push(`\n📊 AI Reasoning:`)
        parts.push(aiResponse.reasoning)
      }
      
      if (aiResponse.referencedDocs.length > 0) {
        parts.push(`\n📚 Referenced Documentation:`)
        aiResponse.referencedDocs.forEach((doc, index) => {
          const url = aiResponse.referencedUrls?.[index] || ''
          if (url) {
            parts.push(`- ${doc}: ${url}`)
          } else {
            parts.push(`- ${doc}`)
          }
        })
      }
      
      if (aiResponse.notesForAgent) {
        parts.push(`\n📝 Notes for Support Team:`)
        // Format documentation gaps properly
        let formattedNotes = aiResponse.notesForAgent
        if (aiResponse.notesForAgent.includes('Documentation gaps:')) {
          formattedNotes = aiResponse.notesForAgent
            .replace(/Documentation gaps:\s*/i, 'Documentation gaps:\n')
            .replace(/(\d+\))/g, '\n$1')
            .replace(/\.\s*Consider creating/g, '.\n\nConsider creating')
            .trim()
        }
        parts.push(formattedNotes)
      }
      
      if (aiResponse.usageString && !aiResponse.usageString.includes('API call failed')) {
        parts.push(`\n${aiResponse.usageString}`)
      }
      
    } catch (error: any) {
      console.error('Failed to generate AI response:', error.message || error)
      console.error('Full error details:', error)
      parts.push('\nSuggested Response:')
      parts.push('AI response generation failed. Manual response needed.')
    }
  } else {
    parts.push('\nNo suggested response. AI integration not configured.')
  }
  
  return {
    noteText: parts.join('\n'),
    suggestedResponse,
    hasAIResponse,
    aiSentiment: sentiment.angerScore !== keywordSentiment.angerScore ? {
      angerScore: sentiment.angerScore,
      urgencyScore: sentiment.urgencyScore,
      isAngry: sentiment.isAngry,
      isHighUrgency: sentiment.isHighUrgency,
      isSpam: sentiment.isSpam
    } : undefined
  }
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
  wouldTag?: string[] // tags that would be added in dry run
  wouldAddNote?: boolean // whether a note would be added
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const client = new HelpScoutClient()
    const analyzer = new SentimentAnalyzer()
    
    // Initialize Teams client (only if webhook URL is configured)
    let teamsClient: TeamsClient | null = null
    try {
      teamsClient = new TeamsClient()
    } catch (error) {
      console.log('Teams integration not configured - skipping notifications')
    }
    
    // Initialize Claude and Docs clients (only if API keys are configured)
    let claudeClient: ClaudeClient | null = null
    let docsClient: HelpScoutDocsClient | null = null
    
    try {
      claudeClient = new ClaudeClient()
      docsClient = new HelpScoutDocsClient()
      console.log('AI response generation enabled')
    } catch (error: any) {
      console.error('AI integration not configured - using fallback responses:', error.message)
    }
    
    // Check for dry-run mode, limit, and force reprocess
    const dryRun = req.query.dryRun === 'true'
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
    let forceReprocess = req.query.forceReprocess === 'true'
    
    // Check if we should scan closed tickets instead
    const scanClosed = req.query.scanClosed === 'true'
    
    // Get conversations based on mode
    let conversationsData
    if (scanClosed) {
      console.log('Fetching CLOSED conversations for testing...')
      conversationsData = await client.getClosedConversations()
    } else {
      conversationsData = await client.getActiveConversations()
    }
    const conversations = conversationsData._embedded?.conversations || []
    
    console.log(`Found ${conversations.length} ${scanClosed ? 'closed' : 'active'} conversations`)
    
    // Apply limit if specified - try to find tickets without AI notes
    let conversationsToProcess = conversations
    
    if (limit) {
      // First try to find tickets without AI notes
      const ticketsWithoutNotes: any[] = []
      const ticketsWithNotes: any[] = []
      
      for (const conv of conversations) {
        if (ticketsWithoutNotes.length >= limit) break
        
        // Quick check if ticket likely has AI note based on preview
        const hasAINote = conv.preview?.includes('AI Draft Reply Created') || 
                         conv.preview?.includes('ANGRY (Anger:') || 
                         conv.preview?.includes('HIGH URGENCY (Urgency:')
        
        if (!hasAINote) {
          ticketsWithoutNotes.push(conv)
        } else {
          ticketsWithNotes.push(conv)
        }
      }
      
      // Use tickets without notes first, then fill with tickets with notes if needed
      conversationsToProcess = [
        ...ticketsWithoutNotes.slice(0, limit),
        ...ticketsWithNotes.slice(0, Math.max(0, limit - ticketsWithoutNotes.length))
      ]
      
      console.log(`Found ${ticketsWithoutNotes.length} tickets without AI notes`)
      if (ticketsWithoutNotes.length < limit) {
        console.log(`Using ${ticketsWithoutNotes.length} without notes + ${conversationsToProcess.length - ticketsWithoutNotes.length} with notes`)
      }
    }
    
    if (dryRun) {
      console.log('DRY RUN MODE - No tags or notes will be added')
    }
    
    if (limit) {
      console.log(`LIMIT MODE - Processing only first ${limit} tickets out of ${conversations.length} total`)
    }
    
    if (forceReprocess && dryRun && scanClosed) {
      console.log('FORCE REPROCESS MODE - Will reprocess CLOSED tickets in DRY RUN only')
    } else if (forceReprocess) {
      // Safety: only allow force reprocess on closed tickets in dry run
      console.log('⚠️  WARNING: Force reprocess only allowed on closed tickets in dry run mode')
      forceReprocess = false
    }
    
    const urgentTickets: UrgentTicket[] = []
    let taggedCount = 0
    
    // Analyze each conversation
    for (const conversation of conversationsToProcess) {
      // Check existing tags - handle both string and object formats
      const rawTags = conversation.tags || []
      const existingTagNames: string[] = []
      
      rawTags.forEach((tag: any) => {
        if (typeof tag === 'string') {
          existingTagNames.push(tag)
        } else if (tag && typeof tag === 'object' && tag.tag) {
          existingTagNames.push(tag.tag)
        }
      })
      
      const hasUrgencyTag = existingTagNames.includes('high-urgency')
      const hasAngryTag = existingTagNames.includes('angry-customer')
      
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
      
      // Process ALL active/pending tickets
      let tagged = false
      
      try {
        // First handle tagging for urgent/angry/spam tickets
        if (sentiment.isHighUrgency || sentiment.isAngry || sentiment.isSpam) {
          // Handle spam separately
          if (sentiment.isSpam && !existingTagNames.includes('spam')) {
            if (!dryRun) {
              // Tag as spam
              await client.addTag(conversation.id, 'spam')
              taggedCount++
            }
            tagged = true
            
            // Check for existing spam notes before adding
            try {
              const threadsData = await client.getConversationThreads(conversation.id)
              const existingNotes = threadsData._embedded?.threads?.filter(
                (thread: any) => thread.type === 'note'
              ) || []
              
              const hasExistingSpamNote = existingNotes.some((note: any) => 
                note.body?.includes('SPAM DETECTED')
              )
              
              if (!hasExistingSpamNote) {
                const spamNote = createSpamNote(sentiment, textToAnalyze)
                if (dryRun) {
                  console.log(`[DRY RUN] Would add spam note to ${conversation.id}. Note preview: ${spamNote.substring(0, 100)}...`)
                } else {
                  console.log(`Adding spam note to ${conversation.id}. Note preview: ${spamNote.substring(0, 100)}...`)
                  await client.addNote(conversation.id, spamNote, true, conversation.status)
                  console.log(`Successfully added SPAM note to ${conversation.id}`)
                }
              } else {
                console.log(`Skipped spam note for ${conversation.id} - already has spam note`)
              }
            } catch (error) {
              console.error(`Error checking/adding spam note for ${conversation.id}:`, error)
              // If we can't check, add the note anyway to ensure it's there
              const spamNote = createSpamNote(sentiment, textToAnalyze)
              if (!dryRun) {
                await client.addNote(conversation.id, spamNote, true, conversation.status)
              }
            }
          } else if (!sentiment.isSpam && (sentiment.isAngry || sentiment.isHighUrgency)) {
            // Handle angry/urgent tags
            if (sentiment.isAngry) {
              // Angry customers always get both tags
              if (!hasAngryTag) {
                if (!dryRun) {
                  await client.addTag(conversation.id, 'angry-customer')
                }
                tagged = true
              }
              if (!hasUrgencyTag) {
                if (!dryRun) {
                  await client.addTag(conversation.id, 'high-urgency')
                }
                tagged = true
              }
            } else if (sentiment.isHighUrgency && !hasUrgencyTag) {
              // Non-angry but urgent only gets high-urgency tag
              if (!dryRun) {
                await client.addTag(conversation.id, 'high-urgency')
              }
              tagged = true
            }
            
            if (tagged && !dryRun) {
              taggedCount++
              
              // TODO: Teams notifications not yet set up - webhook URL needs to be configured
              // Commenting out until Teams integration is ready
              /*
              // Send Teams notification for newly tagged urgent/angry tickets
              if (teamsClient) {
                try {
                  // For Teams notifications, just send basic info without AI generation
                  // The actual AI response will be generated when adding the note
                  const basicNoteText = `${sentiment.isAngry ? '😡 ANGRY' : '❗ HIGH URGENCY'} - Customer needs immediate attention`
                  
                  await teamsClient.sendUrgentTicketAlert({
                    conversationId: conversation.id,
                    noteText: basicNoteText,
                    customerEmail: conversation.primaryCustomer?.email || 'Unknown',
                    subject: conversation.subject || 'No subject'
                  })
                } catch (error) {
                  console.error(`Failed to send Teams notification for ${conversation.id}:`, error)
                }
              }
              */
            }
          }
        } // End of urgent/angry/spam tagging
        
        // Now handle AI notes and draft replies for ALL tickets (except spam)
        if (!sentiment.isSpam) {
          try {
            // Check if note already exists to avoid duplicates
            const threadsData = await client.getConversationThreads(conversation.id)
            const existingNotes = threadsData._embedded?.threads?.filter(
              (thread: any) => thread.type === 'note'
            ) || []
            
            const hasExistingAINote = existingNotes.some((note: any) => 
              note.body?.includes('AI Draft Reply Created') || 
              note.body?.includes('ANGRY') || 
              note.body?.includes('HIGH URGENCY')
            )
            
            // Check for existing draft replies
            const existingDrafts = threadsData._embedded?.threads?.filter(
              (thread: any) => thread.type === 'reply' && thread.state === 'draft'
            ) || []
            
            const hasExistingDraft = existingDrafts.length > 0
            
            if (!hasExistingAINote || forceReprocess) {
              // Generate AI response and add note for ALL non-spam tickets
              const analysisResult = await createAnalysisNote(sentiment, conversation, claudeClient, docsClient)
              
              // Use AI sentiment if available for tagging
              let finalSentiment = sentiment
              if (analysisResult.aiSentiment) {
                console.log(`Using AI sentiment for tagging - Anger: ${analysisResult.aiSentiment.angerScore}, Urgency: ${analysisResult.aiSentiment.urgencyScore}`)
                finalSentiment = {
                  ...sentiment,
                  ...analysisResult.aiSentiment
                }
                
                // Apply tags based on AI sentiment if not in dry run and not already tagged
                if (!dryRun && !tagged) {
                  if (finalSentiment.isAngry && !hasAngryTag) {
                    await client.addTag(conversation.id, 'angry-customer')
                    console.log(`Added angry-customer tag based on AI sentiment`)
                    tagged = true
                  }
                  if ((finalSentiment.isAngry || finalSentiment.isHighUrgency) && !hasUrgencyTag) {
                    await client.addTag(conversation.id, 'high-urgency')
                    console.log(`Added high-urgency tag based on AI sentiment`)
                    tagged = true
                  }
                  if (tagged) {
                    taggedCount++
                  }
                }
              }
              if (dryRun) {
                console.log(`[DRY RUN] Would add note to ${conversation.id}. Note preview: ${analysisResult.noteText ? analysisResult.noteText.substring(0, 100) + '...' : 'No note'}`)
                if (analysisResult.hasAIResponse && analysisResult.suggestedResponse) {
                  console.log(`[DRY RUN] Would create draft reply with AI response`)
                }
              } else {
                console.log(`Adding note to ${conversation.id}. Note preview: ${analysisResult.noteText ? analysisResult.noteText.substring(0, 100) + '...' : 'No note'}`)
                await client.addNote(conversation.id, analysisResult.noteText, true, conversation.status)
                console.log(`Successfully added note to ticket ${conversation.id}`)
                
                // Create draft reply if we have an AI response and no existing draft
                if (analysisResult.hasAIResponse && analysisResult.suggestedResponse && !hasExistingDraft) {
                  const customerId = conversation.primaryCustomer?.id
                  if (customerId) {
                    try {
                      // Preserve the existing assignee (if any) from the conversation
                      const assignedUserId = conversation.assignee?.id || 0
                      await client.createDraftReply(conversation.id, customerId, analysisResult.suggestedResponse, 'closed', assignedUserId)
                      console.log(`Successfully created draft reply for ticket ${conversation.id} with status: closed and assignee: ${assignedUserId || 'unassigned'}`)
                    } catch (error) {
                      console.error(`Failed to create draft reply for ${conversation.id}:`, error)
                    }
                  } else {
                    console.error(`No customer ID found for conversation ${conversation.id}, cannot create draft reply`)
                  }
                } else if (hasExistingDraft) {
                  console.log(`Skipped draft reply for ${conversation.id} - already has draft`)
                }
              }
            } else {
              console.log(`Skipped AI note for ${conversation.id} - already has AI-generated note`)
            }
          } catch (error) {
            console.error(`Error processing AI response for ${conversation.id}:`, error)
          }
        }
      } catch (error) {
        console.error(`Failed to process conversation ${conversation.id}:`, error)
      }
      
      // Track ticket for reporting
      const wouldTag: string[] = []
      if (sentiment.isSpam && !existingTagNames.includes('spam')) {
        wouldTag.push('spam')
      } else if (!sentiment.isSpam) {
        if (sentiment.isAngry) {
          if (!hasAngryTag) wouldTag.push('angry-customer')
          if (!hasUrgencyTag) wouldTag.push('high-urgency')
        } else if (sentiment.isHighUrgency && !hasUrgencyTag) {
          wouldTag.push('high-urgency')
        }
      }
      
      // Get final sentiment scores (AI if available, keyword otherwise)
      let finalScores = {
        urgencyScore: sentiment.urgencyScore,
        angerScore: sentiment.angerScore
      }
      
      // Check if we processed AI sentiment for this ticket
      if (!sentiment.isSpam) {
        try {
          const threadsData = await client.getConversationThreads(conversation.id)
          const notes = threadsData._embedded?.threads?.filter((thread: any) => thread.type === 'note') || []
          const latestAINote = notes.find((note: any) => 
            note.body?.includes('AI Sentiment Analysis:') ||
            note.body?.includes('ANGRY (Anger:') ||
            note.body?.includes('HIGH URGENCY (Urgency:')
          )
          
          if (latestAINote?.body) {
            // Extract AI scores from note if available
            const angerMatch = latestAINote.body.match(/Anger:\s*(\d+)\/100/)
            const urgencyMatch = latestAINote.body.match(/Urgency:\s*(\d+)\/100/)
            
            if (angerMatch && urgencyMatch) {
              finalScores.angerScore = parseInt(angerMatch[1])
              finalScores.urgencyScore = parseInt(urgencyMatch[1])
              console.log(`Using AI scores from note for reporting - Anger: ${finalScores.angerScore}, Urgency: ${finalScores.urgencyScore}`)
            }
          }
        } catch (err) {
          // Fall back to keyword scores if we can't get AI scores
          console.error(`Could not retrieve AI scores for ${conversation.id}:`, err)
        }
      }
      
      urgentTickets.push({
        conversationId: conversation.id,
        customerEmail: conversation.primaryCustomer?.email || 'Unknown',
        subject: conversation.subject || 'No subject',
        preview: conversation.preview || '',
        urgencyScore: finalScores.urgencyScore,
        angerScore: finalScores.angerScore,
        categories: sentiment.categories,
        indicators: sentiment.indicators,
        createdAt: conversation.createdAt,
        tagged,
        wouldTag: dryRun ? wouldTag : undefined,
        wouldAddNote: dryRun ? wouldTag.length > 0 : undefined
      })
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
    
    // Log summary if limit was used
    if (limit) {
      console.log(`\n📊 === TEST RUN SUMMARY ===`)
      console.log(`Processed ${conversationsToProcess.length} tickets (limit: ${limit})`)
      console.log(`Total tickets available: ${conversations.length}`)
      console.log(`Dry run mode: ${dryRun}`)
      console.log(`AI sentiment analysis: ENABLED`)
      console.log(`=======================\n`)
    }
    
    res.status(200).json({
      success: true,
      scannedCount: conversationsToProcess.length,
      totalAvailable: conversations.length,
      urgentCount: urgentTickets.length,
      newUrgentCount,
      escalationCount,
      angryCount,
      politeUrgentCount,
      spamCount,
      taggedCount,
      urgentTickets: urgentTickets.slice(0, 10), // Top 10
      message: dryRun 
        ? `DRY RUN: Would tag ${newUrgentCount} urgent, ${spamCount} spam`
        : `Tagged ${newUrgentCount} urgent, ${spamCount} spam, ${escalationCount} escalations`,
      timestamp: new Date().toISOString(),
      dryRun,
      limitApplied: limit || null
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