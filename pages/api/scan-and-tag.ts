import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'
import { TeamsClient } from '../../lib/teams-client'
import { ClaudeClient } from '../../lib/claude-client'
import { HelpScoutDocsClient } from '../../lib/helpscout-docs'
import fs from 'fs/promises'
import path from 'path'

async function loadLearningFiles(): Promise<{ learnings: string; gaps: string }> {
  try {
    const learningsPath = path.join(process.cwd(), 'claude-learnings.md')
    const gapsPath = path.join(process.cwd(), 'documentation-gaps.md')
    
    let learnings = ''
    let gaps = ''
    
    try {
      learnings = await fs.readFile(learningsPath, 'utf-8')
    } catch (error) {
      learnings = '# Claude Learning File\n\nThis file tracks learnings from agent responses to improve future AI suggestions.\n\n## Learnings\n\n'
      await fs.writeFile(learningsPath, learnings, 'utf-8')
    }
    
    try {
      gaps = await fs.readFile(gapsPath, 'utf-8')
    } catch (error) {
      gaps = '# Documentation Gaps\n\nThis file tracks missing documentation identified during support conversations.\n\n## Gaps\n\n'
      await fs.writeFile(gapsPath, gaps, 'utf-8')
    }
    
    return { learnings, gaps }
  } catch (error) {
    console.error('Error loading learning files:', error)
    return { learnings: '', gaps: '' }
  }
}

interface PreviousSentiment {
  angerScore: number
  urgencyScore: number
  noteCreatedAt: string
}

interface AIResponse {
  angerScore: number
  urgencyScore: number
  isAngry: boolean
  isHighUrgency: boolean
  isSpam: boolean
  angerTriggers?: string[]
  urgencyTriggers?: string[]
  sentimentReasoning?: string
  suggestedResponse?: string
  notesForAgent?: string
  confidence?: number
  referencedDocs?: string[]
  referencedUrls?: string[]
  error?: boolean
  errorMessage?: string
  usageString?: string
}

interface AnalysisResult {
  noteText: string
  aiResponse?: AIResponse
  suggestedResponse?: string
  error?: boolean
  errorMessage?: string
}

function parsePreviousSentiment(threads: any[]): PreviousSentiment | null {
  // Find the most recent AI note with sentiment data
  const aiNotes = threads
    .filter(thread => 
      thread.type === 'note' && 
      thread.body?.includes('[SENTIMENT_DATA:')
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  if (aiNotes.length === 0) return null
  
  const latestNote = aiNotes[0]
  // Look for both old format and new HTML comment format
  const match = latestNote.body.match(/\[SENTIMENT_DATA: U(\d+)_A(\d+)\]/) || 
                latestNote.body.match(/<!-- \[SENTIMENT_DATA: U(\d+)_A(\d+)\] -->/)
  
  if (!match) return null
  
  return {
    urgencyScore: parseInt(match[1]),
    angerScore: parseInt(match[2]),
    noteCreatedAt: latestNote.createdAt
  }
}

function hasNewCustomerMessage(threads: any[], lastNoteTime: string): boolean {
  const lastNoteDate = new Date(lastNoteTime)
  
  return threads.some(thread => 
    thread.type === 'customer' && 
    new Date(thread.createdAt) > lastNoteDate
  )
}

async function createAnalysisNote(
  conversation: any, 
  claudeClient: ClaudeClient | null,
  docsClient: HelpScoutDocsClient | null,
  previousSentiment: PreviousSentiment | null,
  isInitial: boolean
): Promise<AnalysisResult> {
  const parts = []
  
  // Get the actual message content
  let customerMessage = ''
  let messageContent = ''
  if (conversation._embedded?.threads) {
    const customerThreads = conversation._embedded.threads.filter(
      (thread: any) => thread.type === 'customer'
    )
    if (customerThreads.length > 0) {
      const latestThread = customerThreads[customerThreads.length - 1]
      customerMessage = (latestThread.body || '').replace(/<[^>]*>/g, ' ')
      messageContent = customerMessage.toLowerCase()
    }
  }
  
  const subject = (conversation.subject || '').toLowerCase()
  const combinedText = subject + ' ' + messageContent
  
  // Create a concise issue summary
  let issueSummary = '📝 '
  if (combinedText.includes('cancel')) {
    issueSummary += 'Wants to cancel subscription'
  } else if (combinedText.includes('refund')) {
    issueSummary += 'Requesting refund'
  } else if (combinedText.includes('not working')) {
    issueSummary += 'Feature not working'
  } else if (combinedText.includes('error')) {
    issueSummary += 'Error with app'
  } else if (combinedText.includes('bug')) {
    issueSummary += 'Bug report'
  } else if (combinedText.includes('subscription')) {
    issueSummary += 'Subscription question'
  } else if (combinedText.includes('help')) {
    issueSummary += 'Needs help'
  } else if (combinedText.includes('access')) {
    issueSummary += 'Access issue'
  } else if (combinedText.includes('login') || combinedText.includes('log in')) {
    issueSummary += 'Login problem'
  } else if (subject.length > 0) {
    let cleanSubject = conversation.subject
    if (cleanSubject.toLowerCase().startsWith('re:')) {
      cleanSubject = cleanSubject.substring(3).trim()
    }
    const words = cleanSubject.split(' ').slice(0, 5).join(' ')
    issueSummary += words.length > 30 ? words.substring(0, 30) + '...' : words
  } else {
    issueSummary += 'General inquiry'
  }
  
  parts.push(issueSummary)
  
  // Try to get AI analysis
  let aiResponse: AIResponse
  
  if (!claudeClient || !docsClient) {
    // No Claude integration available
    aiResponse = {
      angerScore: 0,
      urgencyScore: 0,
      isAngry: false,
      isHighUrgency: false,
      isSpam: false,
      error: true,
      errorMessage: 'Claude integration not configured'
    }
  } else {
    try {
      console.log(`Generating AI analysis for conversation ${conversation.id}`)
      
      // Get relevant documentation
      const cachedArticles = await docsClient.getCachedArticles()
      const relevantDocs = docsClient.findRelevantArticles(customerMessage, cachedArticles, 3)
      
      // Load learning files
      const { learnings, gaps } = await loadLearningFiles()
      
      // Build conversation history
      let conversationHistory = `Subject: ${conversation.subject || 'No subject'}\n`
      if (conversation._embedded?.threads) {
        conversation._embedded.threads.forEach((thread: any) => {
          if (thread.type === 'customer') {
            const cleanBody = (thread.body || '').replace(/<[^>]*>/g, ' ')
            conversationHistory += `\nCustomer: ${cleanBody}\n`
          }
        })
      }
      
      // Add learnings and gaps as context
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
      let customerFirstName = conversation.primaryCustomer?.firstName || undefined
      if (customerFirstName && typeof customerFirstName === 'string') {
        customerFirstName = customerFirstName.charAt(0).toUpperCase() + customerFirstName.slice(1).toLowerCase()
      }
      
      // Call Claude API
      const claudeResponse = await claudeClient.generateResponse(
        customerMessage,
        conversationHistory,
        contextDocs,
        customerFirstName
      )
      
      aiResponse = {
        angerScore: claudeResponse.angerScore || 0,
        urgencyScore: claudeResponse.urgencyScore || 0,
        isAngry: (claudeResponse.angerScore || 0) >= 40,
        isHighUrgency: (claudeResponse.urgencyScore || 0) >= 60,
        isSpam: claudeResponse.isSpam || false,
        angerTriggers: claudeResponse.angerTriggers,
        urgencyTriggers: claudeResponse.urgencyTriggers,
        sentimentReasoning: claudeResponse.sentimentReasoning,
        suggestedResponse: claudeResponse.suggestedResponse,
        notesForAgent: claudeResponse.notesForAgent,
        confidence: claudeResponse.confidence,
        referencedDocs: claudeResponse.referencedDocs,
        referencedUrls: claudeResponse.referencedUrls,
        usageString: claudeResponse.usageString,
        error: false
      }
      
      console.log(`AI analysis complete - Anger: ${aiResponse.angerScore}/100, Urgency: ${aiResponse.urgencyScore}/100`)
      
    } catch (error: any) {
      console.error(`Failed to generate AI analysis for conversation ${conversation.id}:`, error)
      aiResponse = {
        angerScore: 0,
        urgencyScore: 0,
        isAngry: false,
        isHighUrgency: false,
        isSpam: false,
        error: true,
        errorMessage: `Claude API error: ${error.message}`
      }
    }
  }
  
  // For errors, just return the error message
  if (aiResponse.error) {
    return {
      noteText: `❌ ${aiResponse.errorMessage}`,
      aiResponse,
      suggestedResponse: undefined,
      error: true,
      errorMessage: aiResponse.errorMessage
    }
  }
  
  // Check if we should create note based on sentiment change (for incremental flow)
  if (!isInitial && previousSentiment) {
    const angerIncrease = aiResponse.angerScore - previousSentiment.angerScore
    const urgencyIncrease = aiResponse.urgencyScore - previousSentiment.urgencyScore
    
    if (angerIncrease < 20 && urgencyIncrease < 20) {
      console.log(`Sentiment stable - Anger: ${angerIncrease >= 0 ? '+' : ''}${angerIncrease}, Urgency: ${urgencyIncrease >= 0 ? '+' : ''}${urgencyIncrease}`)
      return {
        noteText: '',
        aiResponse,
        suggestedResponse: undefined,
        error: false
      }
    }
    
    // Add escalation indicator
    parts.push(`🔺 ESCALATION - Anger: ${angerIncrease >= 0 ? '+' : ''}${angerIncrease}, Urgency: ${urgencyIncrease >= 0 ? '+' : ''}${urgencyIncrease}`)
  }
  
  // Add header based on AI sentiment
  let header = ''
  if (aiResponse.isAngry) {
    header = `😡 ANGRY (Anger: ${aiResponse.angerScore}/100, Urgency: ${aiResponse.urgencyScore}/100)`
  } else if (aiResponse.isHighUrgency) {
    header = `❗ HIGH URGENCY (Urgency: ${aiResponse.urgencyScore}/100, Anger: ${aiResponse.angerScore}/100)`
  } else {
    header = `💬 STANDARD (Urgency: ${aiResponse.urgencyScore}/100, Anger: ${aiResponse.angerScore}/100)`
  }
  parts.push(header)
  
  // Add AI analysis details if available
  if (aiResponse.sentimentReasoning) {
    parts.push(`\n🤖 AI Sentiment Analysis:`)
    // Split sentiment reasoning into bullet points by sentences
    const sentimentLines = aiResponse.sentimentReasoning
      .split(/(?<=[.!?])\s+/)
      .filter(line => line.trim())
    sentimentLines.forEach(line => {
      parts.push(`- ${line.trim()}`)
    })
  }
  
  // Add triggers if detected
  if (aiResponse.angerTriggers?.length || aiResponse.urgencyTriggers?.length) {
    parts.push('\n🔍 Triggers Detected:')
    if (aiResponse.angerTriggers?.length) {
      parts.push(`- Anger: ${aiResponse.angerTriggers.join(', ')}`)
    }
    if (aiResponse.urgencyTriggers?.length) {
      parts.push(`- Urgency: ${aiResponse.urgencyTriggers.join(', ')}`)
    }
  }
  
  // Add confidence and metadata (but not the suggested response since it's in the draft)
    if (aiResponse.confidence !== undefined) {
      parts.push(`\n📊 AI Response Confidence: ${Math.round(aiResponse.confidence * 100)}%`)
      parts.push('(Higher confidence indicates the AI found relevant documentation and clear patterns)')
    }
    
    if (aiResponse.referencedDocs?.length) {
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
      parts.push(`\n📝 Notes for Agent:`)
      // Split notes by common patterns and format each on its own line
      const noteLines = aiResponse.notesForAgent
        .split(/(?=Documentation gap:|Missing:|No |Consider:)/)
        .filter(line => line.trim())
      noteLines.forEach((line, index) => {
        const trimmedLine = line.trim()
        // Check if this line starts with a keyword pattern
        if (trimmedLine.match(/^(Documentation gap:|Missing:|No |Consider:|Recommend:)/)) {
          parts.push(trimmedLine)
        } else if (index > 0) {
          // If it doesn't start with a pattern and it's not the first line, add a line break
          parts.push(`\n${trimmedLine}`)
        } else {
          parts.push(trimmedLine)
        }
      })
    }
  
  // Add usage tracking
  if (aiResponse.usageString && !aiResponse.usageString.includes('API call failed')) {
    parts.push(`\n${aiResponse.usageString}`)
  }
  
  // Add hidden sentiment data for tracking (HTML comment so it's not visible in HelpScout)
  parts.push(`\n<!-- [SENTIMENT_DATA: U${aiResponse.urgencyScore}_A${aiResponse.angerScore}] -->`)
  
  return {
    noteText: parts.join('\n'),
    aiResponse,
    suggestedResponse: aiResponse.suggestedResponse,
    error: aiResponse.error,
    errorMessage: aiResponse.errorMessage
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const client = new HelpScoutClient()
    const claudeClient = new ClaudeClient()
    const docsClient = new HelpScoutDocsClient()
    
    // Initialize Teams client only if webhook URL is configured
    let teamsClient: TeamsClient | null = null
    if (process.env.TEAMS_WEBHOOK_URL) {
      teamsClient = new TeamsClient()
    }
    
    // Extract parameters
    const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true
    const limit = req.query.limit ? parseInt(req.query.limit as string) : req.body?.limit
    const scanClosed = req.query.scanClosed === 'true' || req.body?.scanClosed === true
    let forceReprocess = req.query.forceReprocess === 'true' || req.body?.forceReprocess === true
    const conversationId = req.query.conversationId as string || req.body?.conversationId
    
    console.log(`Starting scan with params: dryRun=${dryRun}, limit=${limit}, scanClosed=${scanClosed}, forceReprocess=${forceReprocess}, conversationId=${conversationId}`)
    
    // Safety check for forceReprocess
    if (forceReprocess && (!dryRun || !scanClosed)) {
      console.log('⚠️  WARNING: Force reprocess only allowed on closed tickets in dry run mode')
      forceReprocess = false
    }
    
    // Get conversations based on parameters
    let conversations = []
    
    if (conversationId) {
      // Get specific conversation
      try {
        const conversation = await client.getConversation(conversationId)
        conversations = [conversation]
        console.log(`Found specific conversation ${conversationId}`)
      } catch (error) {
        console.error(`Failed to fetch conversation ${conversationId}:`, error)
        return res.status(404).json({
          success: false,
          error: `Conversation ${conversationId} not found`
        })
      }
    } else {
      // Get list of conversations
      const conversationsResponse = scanClosed 
        ? await client.getClosedConversations(limit || 50)
        : await client.getActiveConversations()
      
      conversations = conversationsResponse._embedded?.conversations || []
      
      // Apply limit if specified
      if (limit && conversations.length > limit) {
        conversations = conversations.slice(0, limit)
      }
    }
    
    console.log(`Found ${conversations.length} ${scanClosed ? 'closed' : 'active/pending'} conversations to process`)
    
    // Process conversations
    const results = {
      scannedCount: 0,
      taggedCount: 0,
      notesAdded: 0,
      errors: 0,
      urgentTickets: [] as any[],
      angryTickets: [] as any[],
      spamTickets: [] as any[]
    }
    
    for (const conversation of conversations) {
      results.scannedCount++
      
      try {
        // Get conversation threads
        const threadsData = await client.getConversationThreads(conversation.id)
        const allThreads = threadsData._embedded?.threads || []
        
        // Check for previous AI sentiment
        const previousSentiment = parsePreviousSentiment(allThreads)
        
        // Determine if this is initial or incremental flow
        let shouldProcess = false
        let isInitial = false
        
        if (!previousSentiment) {
          // Flow 1: Initial message (no previous AI notes)
          shouldProcess = true
          isInitial = true
          console.log(`${conversation.id}: Initial analysis - no previous AI notes`)
        } else if (hasNewCustomerMessage(allThreads, previousSentiment.noteCreatedAt)) {
          // Flow 2: Incremental (has previous AI note and new customer message)
          shouldProcess = true
          isInitial = false
          console.log(`${conversation.id}: New customer message since last AI note`)
        } else {
          // No new activity
          shouldProcess = false
          console.log(`${conversation.id}: No new customer messages - skipping`)
        }
        
        // Force reprocess override (only in dry run on closed tickets)
        if (forceReprocess && scanClosed && dryRun) {
          shouldProcess = true
          console.log(`${conversation.id}: Force reprocess enabled`)
        }
        
        if (!shouldProcess) {
          continue
        }
        
        // Generate AI analysis and note
        const analysisResult = await createAnalysisNote(
          conversation,
          claudeClient,
          docsClient,
          previousSentiment,
          isInitial
        )
        
        // Skip if sentiment didn't escalate (for incremental flow)
        if (!isInitial && !analysisResult.noteText) {
          console.log(`${conversation.id}: Sentiment stable - no note needed`)
          continue
        }
        
        // Get existing tags
        const existingTags = conversation.tags || []
        const existingTagNames = existingTags.map((tag: any) => tag.tag)
        
        // Determine what tags to add based on AI analysis
        const tagsToAdd: string[] = []
        if (analysisResult.aiResponse && !analysisResult.aiResponse.error) {
          if (analysisResult.aiResponse.isSpam && !existingTagNames.includes('spam')) {
            tagsToAdd.push('spam')
          }
          if (analysisResult.aiResponse.isAngry && !existingTagNames.includes('angry-customer')) {
            tagsToAdd.push('angry-customer')
          }
          if ((analysisResult.aiResponse.isAngry || analysisResult.aiResponse.isHighUrgency) && 
              !existingTagNames.includes('high-urgency')) {
            tagsToAdd.push('high-urgency')
          }
        }
        
        // Apply changes
        if (!dryRun) {
          // Add tags
          for (const tag of tagsToAdd) {
            await client.addTag(conversation.id, tag)
            console.log(`Added ${tag} tag to ${conversation.id}`)
          }
          
          // Add note
          await client.addNote(conversation.id, analysisResult.noteText, true, conversation.status)
          console.log(`Added note to ${conversation.id}`)
          results.notesAdded++
          
          // Create draft reply if we have one (and no existing draft)
          const existingDrafts = allThreads.filter(
            (thread: any) => thread.type === 'reply' && thread.state === 'draft'
          )
          
          if (analysisResult.suggestedResponse && existingDrafts.length === 0 && !analysisResult.error) {
            const customerId = conversation.primaryCustomer?.id
            if (customerId) {
              try {
                await client.createDraftReply(
                  conversation.id,
                  customerId,
                  analysisResult.suggestedResponse,
                  'closed'
                )
                console.log(`Created draft reply for ${conversation.id}`)
              } catch (error) {
                console.error(`Failed to create draft reply for ${conversation.id}:`, error)
              }
            }
          }
        } else {
          // Dry run logging
          if (tagsToAdd.length > 0) {
            console.log(`[DRY RUN] Would add tags to ${conversation.id}: ${tagsToAdd.join(', ')}`)
          }
          console.log(`[DRY RUN] Would add note to ${conversation.id}`)
          console.log(`[DRY RUN] Note preview: ${analysisResult.noteText.substring(0, 200)}...`)
        }
        
        // Track results
        if (tagsToAdd.length > 0) {
          results.taggedCount++
        }
        
        // Categorize ticket
        if (analysisResult.aiResponse) {
          const ticketInfo = {
            conversationId: conversation.id,
            customerEmail: conversation.primaryCustomer?.email || 'Unknown',
            subject: conversation.subject || 'No subject',
            preview: analysisResult.noteText.substring(0, 200) + '...',
            urgencyScore: analysisResult.aiResponse.urgencyScore,
            angerScore: analysisResult.aiResponse.angerScore,
            createdAt: conversation.createdAt,
            tagged: tagsToAdd.length > 0,
            wouldTag: dryRun ? tagsToAdd : undefined,
            error: analysisResult.aiResponse.error
          }
          
          if (analysisResult.aiResponse.isSpam) {
            results.spamTickets.push(ticketInfo)
          } else if (analysisResult.aiResponse.isAngry) {
            results.angryTickets.push(ticketInfo)
            results.urgentTickets.push(ticketInfo)
          } else if (analysisResult.aiResponse.isHighUrgency) {
            results.urgentTickets.push(ticketInfo)
          }
        }
        
      } catch (error) {
        console.error(`Failed to process conversation ${conversation.id}:`, error)
        results.errors++
      }
    }
    
    // Sort results by score
    results.urgentTickets.sort((a, b) => b.urgencyScore - a.urgencyScore)
    results.angryTickets.sort((a, b) => b.angerScore - a.angerScore)
    
    // Return results
    res.status(200).json({
      success: true,
      scannedCount: results.scannedCount,
      totalAvailable: conversations.length,
      urgentCount: results.urgentTickets.length,
      angryCount: results.angryTickets.length,
      spamCount: results.spamTickets.length,
      taggedCount: results.taggedCount,
      notesAdded: results.notesAdded,
      errors: results.errors,
      urgentTickets: results.urgentTickets,
      message: dryRun 
        ? `DRY RUN: Would tag ${results.taggedCount} tickets and add ${results.notesAdded} notes`
        : `Tagged ${results.taggedCount} tickets and added ${results.notesAdded} notes`,
      timestamp: new Date().toISOString(),
      dryRun,
      limitApplied: limit
    })
    
  } catch (error: any) {
    console.error('Error in scan-and-tag:', error)
    res.status(500).json({ 
      error: 'Failed to scan conversations', 
      details: error.message 
    })
  }
}