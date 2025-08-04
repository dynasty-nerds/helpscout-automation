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
  
  return `🗑️ SPAM DETECTED (${confidence} confidence)

Reasons:
${reasons.join('\n')}

Total spam indicators found: ${sentiment.indicators.spamIndicatorCount}`
}

interface AnalysisResult {
  noteText: string
  suggestedResponse?: string
  hasAIResponse: boolean
}

async function createAnalysisNote(
  sentiment: SentimentResult, 
  conversation: any, 
  claudeClient?: ClaudeClient | null,
  docsClient?: HelpScoutDocsClient | null
): Promise<AnalysisResult> {
  const parts = []
  
  // Header based on type with both scores
  if (sentiment.isAngry) {
    parts.push(`😡 ANGRY (Anger: ${sentiment.angerScore}/100, Urgency: ${sentiment.urgencyScore}/100)`)
  } else if (sentiment.isHighUrgency) {
    parts.push(`❗ HIGH URGENCY (Urgency: ${sentiment.urgencyScore}/100, Anger: ${sentiment.angerScore}/100)`)
  } else {
    // For non-urgent tickets, just show the scores without emoji
    parts.push(`Urgency: ${sentiment.urgencyScore}/100, Anger: ${sentiment.angerScore}/100`)
  }
  
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
      const customerFirstName = conversation.primaryCustomer?.firstName || conversation.primaryCustomer?.first || undefined
      
      // Generate AI response
      console.log(`Calling Claude API for conversation ${conversation.id}`)
      console.log(`Customer message preview: ${customerMessage.substring(0, 100)}...`)
      console.log(`Found ${relevantDocs.length} relevant docs`)
      const aiResponse = await claudeClient.generateResponse(
        customerMessage,
        conversationHistory,
        contextDocs,
        customerFirstName
      )
      console.log(`AI response generated for conversation ${conversation.id}: ${aiResponse.suggestedResponse.substring(0, 50)}...`)
      
      // Store the suggested response separately
      suggestedResponse = aiResponse.suggestedResponse
      hasAIResponse = true
      
      parts.push(`\n✅ AI Draft Reply Created [Confidence: ${Math.round(aiResponse.confidence * 100)}% | Type: ${aiResponse.responseType}]`)
      
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
    hasAIResponse
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
    
    // Check for dry-run mode
    const dryRun = req.query.dryRun === 'true'
    
    // Get all active conversations
    const conversationsData = await client.getActiveConversations()
    const conversations = conversationsData._embedded?.conversations || []
    
    console.log(`Found ${conversations.length} active conversations`)
    if (dryRun) {
      console.log('DRY RUN MODE - No tags or notes will be added')
    }
    
    const urgentTickets: UrgentTicket[] = []
    let taggedCount = 0
    
    // Analyze each conversation
    for (const conversation of conversations) {
      // TEMPORARY: Only process test tickets
      const testTickets = [2928025395, 3023420232, 2620095977] // angry, low urgency, urgent
      if (!testTickets.includes(conversation.id)) {
        continue
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
      
      // Process ALL active/pending tickets
      let tagged = false
      
      try {
        // First handle tagging for urgent/angry/spam tickets
        if (sentiment.isHighUrgency || sentiment.isAngry || sentiment.isSpam) {
        let tagged = false
        let isEscalation = false
        
        try {
          // Handle spam separately
          if (sentiment.isSpam && !existingTags.includes('spam')) {
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
                  await client.addNote(conversation.id, spamNote)
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
                await client.addNote(conversation.id, spamNote)
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
          
        } // End of tagging block
        
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
            
            if (!hasExistingAINote) {
              // Generate AI response and add note for ALL non-spam tickets
              const analysisResult = await createAnalysisNote(sentiment, conversation, claudeClient, docsClient)
              if (dryRun) {
                console.log(`[DRY RUN] Would add note to ${conversation.id}. Note preview: ${analysisResult.noteText.substring(0, 100)}...`)
                if (analysisResult.hasAIResponse && analysisResult.suggestedResponse) {
                  console.log(`[DRY RUN] Would create draft reply with AI response`)
                }
              } else {
                console.log(`Adding note to ${conversation.id}. Note preview: ${analysisResult.noteText.substring(0, 100)}...`)
                await client.addNote(conversation.id, analysisResult.noteText)
                console.log(`Successfully added note to ticket ${conversation.id}`)
                
                // Create draft reply if we have an AI response and no existing draft
                if (analysisResult.hasAIResponse && analysisResult.suggestedResponse && !hasExistingDraft) {
                  const customerId = conversation.primaryCustomer?.id
                  if (customerId) {
                    try {
                      await client.createDraftReply(conversation.id, customerId, analysisResult.suggestedResponse)
                      console.log(`Successfully created draft reply for ticket ${conversation.id}`)
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
        
        const wouldTag: string[] = []
        if (sentiment.isSpam && !existingTags.includes('spam')) {
          wouldTag.push('spam')
        } else if (!sentiment.isSpam) {
          if (sentiment.isAngry) {
            if (!hasAngryTag) wouldTag.push('angry-customer')
            if (!hasUrgencyTag) wouldTag.push('high-urgency')
          } else if (sentiment.isHighUrgency && !hasUrgencyTag) {
            wouldTag.push('high-urgency')
          }
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
          tagged,
          wouldTag: dryRun ? wouldTag : undefined,
          wouldAddNote: dryRun ? wouldTag.length > 0 : undefined
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
      message: dryRun 
        ? `DRY RUN: Would tag ${newUrgentCount} urgent, ${spamCount} spam`
        : `Tagged ${newUrgentCount} urgent, ${spamCount} spam, ${escalationCount} escalations`,
      timestamp: new Date().toISOString(),
      dryRun
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