import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'
// TeamsClient import removed - not currently being used
import { ClaudeClient } from '../../lib/claude-client'
import { HelpScoutDocsClient } from '../../lib/helpscout-docs'
import { memberPressService } from '../../src/services/memberPressService'
import { fastDraftService } from '../../src/services/fastDraftService'
// Removed fs and path imports - no longer reading static markdown files
import packageJson from '../../package.json'

// Removed loadLearningFiles function - no longer using static markdown files for learnings/gaps
// Documentation gaps are now tracked per-ticket since documentation evolves over time
// Claude learnings are managed via system prompt updates

// Removed loadCommonIssues function - common issues should come from HelpScout docs directly
// Not from hard-coded markdown files that can become stale

// Parse valid tags from the tagging system document
function parseValidTagsFromDocument(docText: string): Set<string> {
  const validTags = new Set<string>()
  
  // Add sentiment/special tags that are handled separately
  validTags.add('spam')
  validTags.add('angry-customer')
  validTags.add('high-urgency')
  validTags.add('ai-drafts') // HelpScout native AI tag
  validTags.add('call-sheet') // Special internal tag
  
  // Parse all tags that start with # symbol
  // This will catch both standalone tags and parent/child tags
  // Handles tags with or without bullet points/list markers
  const tagMatches = Array.from(docText.matchAll(/#([a-z-]+(?:\/[a-z-]+)?)/gm))
  for (const match of tagMatches) {
    // Only add valid tag names (no special characters at the end)
    const cleanTag = match[1].replace(/[^a-z\/-]+$/, '')
    if (cleanTag) {
      validTags.add(cleanTag)
    }
  }
  
  // Also look for tags in bold markdown format (fallback for old format)
  const boldTagMatches = Array.from(docText.matchAll(/\*\*([a-z-]+(?:\/[a-z-]+)?)\*\*/g))
  for (const match of boldTagMatches) {
    // Only add if it looks like a valid tag (contains only lowercase letters, hyphens, and optionally one slash)
    if (/^[a-z-]+(?:\/[a-z-]+)?$/.test(match[1])) {
      validTags.add(match[1])
    }
  }
  
  console.log(`Parsed tags from document: ${Array.from(validTags).join(', ')}`)
  
  return validTags
}

// Check if tags exist in HelpScout and report missing ones
async function checkForMissingTags(
  client: HelpScoutClient,
  validTagsFromDoc: Set<string>,
  existingHelpScoutTags: Set<string>
): Promise<string | null> {
  const missingFromDoc: string[] = []
  const missingFromHelpScout: string[] = []
  
  // Check which HelpScout tags are not in our documentation
  existingHelpScoutTags.forEach(hsTag => {
    if (!validTagsFromDoc.has(hsTag) && 
        !hsTag.startsWith('vip') && // Ignore VIP tags
        !hsTag.includes('@') && // Ignore email tags
        !hsTag.match(/^\d/) && // Ignore date-specific tags
        hsTag !== 'call-sheet' && // Special internal tag
        hsTag !== 'samples') { // Ignore samples tag
      missingFromDoc.push(hsTag)
    }
  })
  
  // Check which documented tags don't exist in HelpScout
  validTagsFromDoc.forEach(docTag => {
    if (!existingHelpScoutTags.has(docTag) && 
        !['ai-drafts'].includes(docTag)) { // Skip system tags
      missingFromHelpScout.push(docTag)
    }
  })
  
  if (missingFromDoc.length > 0 || missingFromHelpScout.length > 0) {
    let report = '📋 Tag System Audit:\n\n'
    
    if (missingFromDoc.length > 0) {
      report += `Tags in HelpScout but not in documentation (${missingFromDoc.length}):\n`
      report += missingFromDoc.map(t => `  - ${t}`).join('\n')
      report += '\n\n'
    }
    
    if (missingFromHelpScout.length > 0) {
      report += `Tags in documentation but not created in HelpScout (${missingFromHelpScout.length}):\n`
      report += missingFromHelpScout.map(t => `  - ${t}`).join('\n')
      report += '\n\n'
    }
    
    report += 'Consider updating the Topic Tagging System document or creating missing tags in HelpScout.'
    
    return report
  }
  
  return null
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
  memberPressInfo?: string
  confidence?: number
  referencedDocs?: string[]
  referencedUrls?: string[]
  error?: boolean
  errorMessage?: string
  usageString?: string
  issueCategory?: string
  topicTag?: string  // Topic tag from the tagging system
  cost?: number
  inputTokens?: number
  outputTokens?: number
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
    .filter(thread => {
      if (thread.type !== 'note') return false
      const body = thread.body || ''
      // Look for our AI note markers
      return body.includes('🤖 AI Sentiment Analysis:') || 
             body.includes('[SENTIMENT_DATA:') ||
             body.includes('<!-- [SENTIMENT_DATA:')
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  if (aiNotes.length === 0) return null
  
  const latestNote = aiNotes[0]
  // Try multiple formats to find sentiment data
  const body = latestNote.body || ''
  
  // Try to extract from various formats
  let match = body.match(/\[SENTIMENT_DATA: U(\d+)_A(\d+)\]/)
  if (!match) match = body.match(/<!-- \[SENTIMENT_DATA: U(\d+)_A(\d+)\] -->/)
  if (!match) match = body.match(/SENTIMENT_DATA: U(\d+)_A(\d+)/)
  
  // If still no match, try to extract from the visible scores in header
  if (!match) {
    // Try new format: (A75, U85)
    const headerMatch = body.match(/\(A(\d+), U(\d+)\)/)
    if (headerMatch) {
      return {
        urgencyScore: parseInt(headerMatch[2]),
        angerScore: parseInt(headerMatch[1]),
        noteCreatedAt: latestNote.createdAt
      }
    }
    
    // Try old format: Anger: X/100, Urgency: Y/100
    const angerMatch = body.match(/Anger: (\d+)\/100/)
    const urgencyMatch = body.match(/Urgency: (\d+)\/100/)
    if (angerMatch && urgencyMatch) {
      return {
        urgencyScore: parseInt(urgencyMatch[1]),
        angerScore: parseInt(angerMatch[1]),
        noteCreatedAt: latestNote.createdAt
      }
    }
  }
  
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
  isInitial: boolean,
  taggingSystemDoc: any | null
): Promise<AnalysisResult> {
  const parts = []
  
  // Check for "call sheet" emails from hello@dynastynerds.com
  const customerEmail = conversation.primaryCustomer?.email?.toLowerCase()
  const subject = (conversation.subject || '').toLowerCase()
  
  if (customerEmail === 'hello@dynastynerds.com' && subject.includes('call sheet')) {
    console.log(`Skipping analysis for call sheet email from ${customerEmail}`)
    return {
      noteText: '📋 Call Sheet - No analysis needed',
      aiResponse: {
        angerScore: 0,
        urgencyScore: 0,
        isAngry: false,
        isHighUrgency: false,
        isSpam: false,
        topicTag: 'call-sheet',
        issueCategory: 'Call Sheet',
        error: false
      },
      suggestedResponse: undefined,
      error: false
    }
  }
  
  // Get the actual message content
  let customerMessage = ''
  if (conversation._embedded?.threads) {
    const customerThreads = conversation._embedded.threads.filter(
      (thread: any) => thread.type === 'customer'
    )
    if (customerThreads.length > 0) {
      const latestThread = customerThreads[customerThreads.length - 1]
      customerMessage = (latestThread.body || '').replace(/<[^>]*>/g, ' ')
    }
  }
  // Removed combinedText - was not being used
  
  // We'll set the issue summary after we get the AI response
  let issueSummary = '🗃️ '
  
  // Prepare fallback category from subject
  let fallbackCategory = ''
  if (subject.length > 0) {
    let cleanSubject = conversation.subject
    if (cleanSubject.toLowerCase().startsWith('re:')) {
      cleanSubject = cleanSubject.substring(3).trim()
    }
    const words = cleanSubject.split(' ').slice(0, 5).join(' ')
    fallbackCategory = words.length > 30 ? words.substring(0, 30) + '...' : words
  } else {
    fallbackCategory = 'General inquiry'
  }
  
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
      console.log(`🤖 CLAUDE API CALL: Generating AI analysis for conversation ${conversation.id}`)
      console.log(`   Customer: ${conversation.primaryCustomer?.email || 'Unknown'}`)
      console.log(`   Subject: ${conversation.subject || 'No subject'}`)
      console.log(`   Message length: ${customerMessage.length} chars`)
      
      // Get relevant documentation
      const cachedArticles = await docsClient.getCachedArticles()
      console.log(`Total cached articles available: ${cachedArticles.length}`)
      const relevantDocs = docsClient.findRelevantArticles(customerMessage, cachedArticles, 3)
      console.log(`Found ${relevantDocs.length} relevant docs for message: "${customerMessage.substring(0, 50)}..."`)
      if (relevantDocs.length > 0) {
        console.log('Relevant docs found:', relevantDocs.map(doc => ({ name: doc.name, url: doc.publicUrl })))
      }
      
      // Always fetch the changelog/fixes document (unpublished)
      let changelogDoc = null
      try {
        const changelogId = '68919485bb013911a3b209ac'
        changelogDoc = await docsClient.getArticle(changelogId)
        if (changelogDoc) {
          console.log('Successfully fetched changelog document')
        }
      } catch (error) {
        console.error('Failed to fetch changelog document:', error)
      }
      
      // Always fetch the known issues document (unpublished)
      let knownIssuesDoc = null
      try {
        const knownIssuesId = '68919c52816719208b5a1a93'
        knownIssuesDoc = await docsClient.getArticle(knownIssuesId)
        if (knownIssuesDoc) {
          console.log('Successfully fetched known issues document')
        }
      } catch (error) {
        console.error('Failed to fetch known issues document:', error)
      }
      
      // No longer loading static learning files - documentation gaps tracked per-ticket
      
      // Build conversation history
      let conversationHistory = `Subject: ${conversation.subject || 'No subject'}\n`
      if (conversation._embedded?.threads) {
        conversation._embedded.threads.forEach((thread: any) => {
          if (thread.type === 'customer') {
            const cleanBody = (thread.body || '').replace(/<[^>]*>/g, ' ')
            conversationHistory += `\nCustomer: ${cleanBody}\n`
          } else if (thread.type === 'reply' && thread.state === 'published') {
            // Include agent responses (but not drafts or notes)
            const cleanBody = (thread.body || '').replace(/<[^>]*>/g, ' ')
            const agentName = thread.createdBy?.firstName || 'Agent'
            conversationHistory += `\nAgent (${agentName}): ${cleanBody}\n`
          }
        })
      }
      
      // Common issues now come from HelpScout docs directly, not static files
      
      // Use only HelpScout docs for context, not static files
      const contextDocs = [...relevantDocs]
      
      // Add changelog document if available (at beginning)
      if (changelogDoc) {
        contextDocs.unshift({
          id: changelogDoc.id,
          name: changelogDoc.name || 'Recent Platform Changes & Fixes',
          text: changelogDoc.text || '',
          publicUrl: 'https://secure.helpscout.net/docs/5f285c7e04286342d763acc4/article/68919485bb013911a3b209ac/',
          collectionId: changelogDoc.collectionId || '',
          status: changelogDoc.status || 'published',
          updatedAt: changelogDoc.updatedAt || new Date().toISOString()
        })
      }
      
      // Add known issues document if available (at beginning)
      if (knownIssuesDoc) {
        contextDocs.unshift({
          id: knownIssuesDoc.id,
          name: knownIssuesDoc.name || 'Known Issues',
          text: knownIssuesDoc.text || '',
          publicUrl: 'https://secure.helpscout.net/docs/5f285c7e04286342d763acc4/article/68919c52816719208b5a1a93/',
          collectionId: knownIssuesDoc.collectionId || '',
          status: knownIssuesDoc.status || 'published',
          updatedAt: knownIssuesDoc.updatedAt || new Date().toISOString()
        })
      }
      
      // Add tagging system document if available (at beginning)
      if (taggingSystemDoc) {
        contextDocs.unshift({
          id: taggingSystemDoc.id,
          name: taggingSystemDoc.name || 'Topic Tagging System',
          text: taggingSystemDoc.text || '',
          publicUrl: 'https://secure.helpscout.net/docs/6894d315cc94a96f86d43e59/article/6894d33473b0d70353930e9e/',
          collectionId: taggingSystemDoc.collectionId || '',
          status: taggingSystemDoc.status || 'published',
          updatedAt: taggingSystemDoc.updatedAt || new Date().toISOString()
        })
      }
      
      // Check if we need MemberPress data based on the message content
      let memberPressContext = null
      const customerEmail = conversation.primaryCustomer?.email
      if (customerEmail) {
        const lowerMessage = customerMessage.toLowerCase()
        const needsMemberPress = 
          lowerMessage.includes('access') ||
          lowerMessage.includes('premium') ||
          lowerMessage.includes('subscription') ||
          lowerMessage.includes('billing') ||
          lowerMessage.includes('cancel') ||
          lowerMessage.includes('refund') ||
          lowerMessage.includes('grandfathered') ||
          lowerMessage.includes('pay') ||
          lowerMessage.includes('upgrade')
        
        if (needsMemberPress) {
          console.log(`Fetching MemberPress data for ${customerEmail}`)
          try {
            memberPressContext = await memberPressService.getMemberPressContext(customerEmail)
            console.log('MemberPress data retrieved:', JSON.stringify(memberPressContext, null, 2))
            
            // Add MemberPress data to conversation history
            conversationHistory += `\n\nMemberPress Subscription Data:
User Email: ${customerEmail}
${JSON.stringify(memberPressContext, null, 2)}\n`
          } catch (error) {
            console.error('Error fetching MemberPress data:', error)
          }
        }

        // Check if we need FastDraft code lookup
        // Check tags for fastdraft
        const hasFastDraftTag = conversation.tags?.some((tag: any) => 
          tag.tag?.toLowerCase().includes('fastdraft') || 
          tag.name?.toLowerCase().includes('fastdraft')
        )
        
        // Check subject for FastDraft
        const subjectLower = (conversation.subject || '').toLowerCase()
        
        const needsFastDraft = 
          hasFastDraftTag ||
          lowerMessage.includes('fastdraft') ||
          lowerMessage.includes('fast draft') ||
          subjectLower.includes('fastdraft') ||
          subjectLower.includes('fast draft')
        
        if (needsFastDraft) {
          console.log(`Checking for FastDraft code for ${customerEmail}`)
          try {
            const fastDraftResult = await fastDraftService.getCodeByEmail(customerEmail)
            if (fastDraftResult.found) {
              console.log(`Found FastDraft code for ${customerEmail}: ${fastDraftResult.code}`)
              conversationHistory += `\n\nFastDraft Code Lookup:
Customer Email: ${customerEmail}
Code Found: Yes
Code: ${fastDraftResult.code}
Note: This code has been automatically retrieved from the FastDraft spreadsheet.\n`
            } else {
              console.log(`No FastDraft code found for ${customerEmail}`)
              conversationHistory += `\n\nFastDraft Code Lookup:
Customer Email: ${customerEmail}
Code Found: No
Note: No code found in the FastDraft spreadsheet for this email address.\n`
            }
          } catch (error) {
            console.error('Error fetching FastDraft code:', error)
          }
        }
      }
      
      // Get customer first name
      console.log(`Extracting customer first name for conversation ${conversation.id}`)
      console.log(`primaryCustomer object:`, JSON.stringify(conversation.primaryCustomer, null, 2))
      console.log(`Looking for firstName: "${conversation.primaryCustomer?.firstName}"`)
      console.log(`Looking for first: "${conversation.primaryCustomer?.first}"`)
      
      let customerFirstName = conversation.primaryCustomer?.firstName || conversation.primaryCustomer?.first || undefined
      console.log(`Raw extracted name: "${customerFirstName}"`)
      
      if (customerFirstName && typeof customerFirstName === 'string') {
        const originalName = customerFirstName
        customerFirstName = customerFirstName.charAt(0).toUpperCase() + customerFirstName.slice(1).toLowerCase()
        console.log(`Formatted name: "${originalName}" -> "${customerFirstName}"`)
      } else {
        console.log(`No valid first name found, using fallback`)
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
        memberPressInfo: claudeResponse.memberPressInfo,
        confidence: claudeResponse.confidence,
        referencedDocs: claudeResponse.referencedDocs,
        referencedUrls: claudeResponse.referencedUrls,
        usageString: claudeResponse.usageString,
        issueCategory: claudeResponse.issueCategory,
        topicTag: claudeResponse.topicTag,
        cost: claudeResponse.cost,
        inputTokens: claudeResponse.inputTokens,
        outputTokens: claudeResponse.outputTokens,
        error: false
      }
      
      console.log(`AI analysis complete - Anger: ${aiResponse.angerScore}/100, Urgency: ${aiResponse.urgencyScore}/100`)
      console.log(`AI issueCategory field: "${aiResponse.issueCategory}"`)
      console.log(`AI topicTag field: "${aiResponse.topicTag}"`)
      console.log(`Fallback category prepared: "${fallbackCategory}"`)
      
      // Use AI-determined category if available
      if (aiResponse.issueCategory) {
        console.log(`AI provided category: "${aiResponse.issueCategory}" - using this for issue summary`)
        issueSummary += aiResponse.issueCategory
        console.log(`Final issue summary with AI category: "${issueSummary}"`)
      } else {
        console.log(`No AI category provided, using fallback: "${fallbackCategory}"`)
        issueSummary += fallbackCategory
        console.log(`Final issue summary with fallback: "${issueSummary}"`)
      }
      
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
  
  // Set fallback category if AI failed or didn't provide one
  if (!aiResponse.issueCategory) {
    issueSummary += fallbackCategory
  }
  
  // Add issue summary to the beginning
  parts.push(issueSummary)
  
  // For errors, return a clean error note without all the extra sections
  if (aiResponse.error) {
    let errorNote = ''
    
    // Use the notesForAgent content if available, otherwise use error message
    if (aiResponse.notesForAgent) {
      errorNote = `❌ ${aiResponse.notesForAgent}`
    } else {
      errorNote = `❌ Error calling Claude API: ${aiResponse.errorMessage}`
    }
    
    // Don't include any other sections - just the error message
    return {
      noteText: errorNote,
      aiResponse,
      suggestedResponse: undefined, // No draft reply on error
      error: true,
      errorMessage: aiResponse.errorMessage
    }
  }
  
  // Check if we should create note based on sentiment change (for incremental flow)
  if (!isInitial && previousSentiment) {
    const angerIncrease = aiResponse.angerScore - previousSentiment.angerScore
    const urgencyIncrease = aiResponse.urgencyScore - previousSentiment.urgencyScore
    
    // Create note if EITHER anger OR urgency increased by 10 or more
    if (angerIncrease >= 10 || urgencyIncrease >= 10) {
      // Continue with note creation - add escalation indicator below
    } else {
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
  
  // Check for spam first - create minimal note and no draft
  if (aiResponse.isSpam) {
    // Create minimal spam note
    let spamNote = '🗑️ SPAM DETECTED\n\n'
    
    // Add reasoning if available
    if (aiResponse.sentimentReasoning) {
      spamNote += `📝 Reasoning: ${aiResponse.sentimentReasoning}\n\n`
    }
    
    // Add usage tracking
    if (aiResponse.usageString) {
      spamNote += `${aiResponse.usageString}\n\n`
    }
    
    // Add project footer
    spamNote += `✍️ Note written by HelpScout Automation Claude Code project v${packageJson.version}`
    
    return {
      noteText: spamNote,
      aiResponse,
      suggestedResponse: undefined, // No draft reply for spam
      error: false
    }
  }
  
  // Add header based on AI sentiment (non-spam)
  let header = ''
  if (aiResponse.isAngry) {
    // Determine anger level based on score
    if (aiResponse.angerScore >= 80) {
      header = `😡 EXTREMELY ANGRY`
    } else if (aiResponse.angerScore >= 60) {
      header = `😡 VERY ANGRY`
    } else {
      header = `😡 ANGRY`
    }
  } else if (aiResponse.isHighUrgency) {
    header = `❗ HIGH URGENCY`
  } else {
    header = `💬 STANDARD`
  }
  parts.push(header)
  
  // Add sentiment data right after header
  parts.push(`[SENTIMENT_DATA: U${aiResponse.urgencyScore}_A${aiResponse.angerScore}]`)
  
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
    }
    
    // Always show referenced documentation section
    parts.push(`\n📚 Referenced Documentation:`)
    if (aiResponse.referencedDocs?.length) {
      // Filter out internal docs
      const externalDocs: string[] = []
      aiResponse.referencedDocs.forEach((doc, index) => {
        const url = aiResponse.referencedUrls?.[index] || ''
        // Skip internal URLs
        if (url && url.startsWith('internal://')) {
          return
        }
        if (url) {
          externalDocs.push(`- ${doc}: ${url}`)
        } else {
          externalDocs.push(`- ${doc}`)
        }
      })
      
      if (externalDocs.length > 0) {
        externalDocs.forEach(doc => parts.push(doc))
      } else {
        parts.push(`- No documentation referenced`)
      }
    } else {
      parts.push(`- No documentation referenced`)
    }
    
    // Add MemberPress Information section if available
    if (aiResponse.memberPressInfo) {
      parts.push(`\n💳 MemberPress Information:`)
      const memberPressLines = aiResponse.memberPressInfo.split('\n').filter(line => line.trim())
      memberPressLines.forEach(line => {
        parts.push(line)
      })
    }
    
    if (aiResponse.notesForAgent) {
      parts.push(`\n📝 Notes for Agent:`)
      // Split by newlines to preserve the structure from Claude
      const lines = aiResponse.notesForAgent.split('\n').filter(line => line.trim())
      let lastWasBullet = false
      
      lines.forEach(line => {
        const trimmedLine = line.trim()
        const isBullet = trimmedLine.startsWith('-')
        
        // If this line doesn't start with a bullet and the last line was a bullet,
        // add a line break before it
        if (!isBullet && lastWasBullet) {
          parts.push(`\n${trimmedLine}`)
        } else {
          parts.push(trimmedLine)
        }
        
        lastWasBullet = isBullet
      })
    }
  
  // Add usage tracking
  if (aiResponse.usageString && !aiResponse.usageString.includes('API call failed')) {
    parts.push(`\n${aiResponse.usageString}`)
  }
  
  // Add version footer
  parts.push(`\n✍️ Note and suggested response written by HelpScout Automation Claude Code project v${packageJson.version}`)
  
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
    
    // Teams client initialization removed - not currently being used
    // Can be re-added when Teams notifications are implemented
    
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
    
    // Fetch tagging system document once at the beginning
    let taggingSystemDoc = null
    let tagAuditReport = null
    try {
      const taggingSystemId = '6894d33473b0d70353930e9e'
      taggingSystemDoc = await docsClient.getArticle(taggingSystemId)
      if (taggingSystemDoc) {
        console.log('Successfully fetched tagging system document')
        
        // Parse valid tags from document
        const validTagsFromDoc = parseValidTagsFromDocument(taggingSystemDoc.text || '')
        console.log(`Found ${validTagsFromDoc.size} valid tags in documentation`)
        
        // Get all existing tags from HelpScout
        const allTagsResponse = await client.getTags()
        const existingHelpScoutTags = new Set<string>()
        if (allTagsResponse?._embedded?.tags) {
          for (const tag of allTagsResponse._embedded.tags) {
            existingHelpScoutTags.add(tag.name)
          }
        }
        console.log(`Found ${existingHelpScoutTags.size} tags in HelpScout`)
        
        // Check for missing tags
        tagAuditReport = await checkForMissingTags(client, validTagsFromDoc, existingHelpScoutTags)
        if (tagAuditReport) {
          console.log('Tag audit found discrepancies:')
          console.log(tagAuditReport)
        }
      }
    } catch (error) {
      console.error('Failed to fetch or parse tagging system document:', error)
    }
    
    // Process conversations
    const results = {
      scannedCount: 0,
      taggedCount: 0,
      notesAdded: 0,
      errors: 0,
      claudeApiCalls: 0,
      skippedDuplicate: 0,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
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
          results.skippedDuplicate++
          continue
        }
        
        // Generate AI analysis and note
        console.log(`📊 Processing conversation ${conversation.id} - Making Claude API call #${results.claudeApiCalls + 1}`)
        const analysisResult = await createAnalysisNote(
          conversation,
          claudeClient,
          docsClient,
          previousSentiment,
          isInitial,
          taggingSystemDoc
        )
        
        // Track if Claude was actually called and accumulate costs
        if (analysisResult.aiResponse && !analysisResult.error) {
          results.claudeApiCalls++
          if (analysisResult.aiResponse.cost) {
            results.totalCost += analysisResult.aiResponse.cost
            results.totalInputTokens += analysisResult.aiResponse.inputTokens || 0
            results.totalOutputTokens += analysisResult.aiResponse.outputTokens || 0
          }
        }
        
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
          // Sentiment tags
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
          
          // Topic tag - only add if provided and not already present
          if (analysisResult.aiResponse.topicTag && !existingTagNames.includes(analysisResult.aiResponse.topicTag)) {
            tagsToAdd.push(analysisResult.aiResponse.topicTag)
            console.log(`Will add topic tag: ${analysisResult.aiResponse.topicTag}`)
          }
        }
        
        // Apply changes
        if (!dryRun) {
          // Add tags
          for (const tag of tagsToAdd) {
            await client.addTag(conversation.id, tag)
            console.log(`Added ${tag} tag to ${conversation.id}`)
          }
          
          // For initial flow only, check if an AI note was created while we were processing
          if (isInitial) {
            const finalThreadsCheck = await client.getConversationThreads(conversation.id)
            const finalThreads = finalThreadsCheck._embedded?.threads || []
            const recentAINotes = parsePreviousSentiment(finalThreads)
            
            if (recentAINotes) {
              console.log(`${conversation.id}: AI note already exists (detected in final check) - skipping`)
              continue
            }
          }
          // For incremental flow, we've already verified:
          // 1. There's a new customer message after the last AI note
          // 2. The sentiment threshold was exceeded
          // So we should create the note
          
          // Add note
          await client.addNote(conversation.id, analysisResult.noteText, true, conversation.status)
          console.log(`Added note to ${conversation.id}`)
          results.notesAdded++
          
          // Create draft reply if we have one (and no existing draft) - but NOT for spam
          const existingDrafts = allThreads.filter(
            (thread: any) => thread.type === 'reply' && thread.state === 'draft'
          )
          
          // Skip draft creation for spam tickets
          const isSpamTicket = analysisResult.aiResponse?.isSpam === true
          
          if (analysisResult.suggestedResponse && existingDrafts.length === 0 && !analysisResult.error && !isSpamTicket) {
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
          } else if (isSpamTicket && analysisResult.suggestedResponse) {
            console.log(`Skipped draft creation for spam ticket ${conversation.id}`)
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
    
    // Log cost summary
    console.log('\n💰 CLAUDE API COST SUMMARY:')
    console.log(`- Total API calls: ${results.claudeApiCalls}`)
    console.log(`- Skipped (already processed): ${results.skippedDuplicate}`)
    console.log(`- Total input tokens: ${results.totalInputTokens.toLocaleString()}`)
    console.log(`- Total output tokens: ${results.totalOutputTokens.toLocaleString()}`)
    console.log(`- TOTAL COST: $${results.totalCost.toFixed(4)}`)
    console.log(`- Average cost per call: $${results.claudeApiCalls > 0 ? (results.totalCost / results.claudeApiCalls).toFixed(4) : '0.0000'}`)
    
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
      tagAuditReport: tagAuditReport,
      claudeApiUsage: {
        apiCalls: results.claudeApiCalls,
        skippedDuplicate: results.skippedDuplicate,
        totalCost: `$${results.totalCost.toFixed(4)}`,
        totalInputTokens: results.totalInputTokens,
        totalOutputTokens: results.totalOutputTokens,
        averageCostPerCall: results.claudeApiCalls > 0 ? `$${(results.totalCost / results.claudeApiCalls).toFixed(4)}` : '$0.0000'
      },
      message: dryRun 
        ? `DRY RUN: Would tag ${results.taggedCount} tickets and add ${results.notesAdded} notes. Cost: $${results.totalCost.toFixed(4)}`
        : `Tagged ${results.taggedCount} tickets and added ${results.notesAdded} notes. Cost: $${results.totalCost.toFixed(4)}`,
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