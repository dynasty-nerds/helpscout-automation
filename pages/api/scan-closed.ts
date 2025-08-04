import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'
import { SentimentAnalyzer } from '../../lib/sentiment-analyzer'

interface AngryExample {
  conversationId: number
  customerEmail: string
  subject: string
  preview: string
  urgencyScore: number
  angerScore: number
  categories: string[]
  indicators: any
  closedAt: string
  notePreview?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const client = new HelpScoutClient()
    const analyzer = new SentimentAnalyzer()
    
    console.log('READ-ONLY SCAN - No tags or notes will be added to closed tickets')
    
    // Fetch ALL closed conversations
    const allConversations = []
    let totalPages = 0
    let hasMore = true
    let page = 1
    
    // First, get one page to see the total count
    const firstPageData = await client.getClosedConversations(1)
    const totalItems = firstPageData.page?.totalElements || 0
    const totalPagesNeeded = Math.ceil(totalItems / 50)
    
    console.log(`Total closed tickets: ${totalItems}, will fetch ${totalPagesNeeded} pages`)
    
    // Add first page conversations
    allConversations.push(...(firstPageData._embedded?.conversations || []))
    
    // Fetch remaining pages
    while (hasMore && page < totalPagesNeeded) {
      page++
      try {
        const conversationsData = await client.getClosedConversations(page)
        const pageConversations = conversationsData._embedded?.conversations || []
        
        if (pageConversations.length === 0) {
          hasMore = false
          break
        }
        
        allConversations.push(...pageConversations)
        
        // Log progress every 10 pages
        if (page % 10 === 0) {
          console.log(`Progress: ${page}/${totalPagesNeeded} pages, ${allConversations.length} conversations`)
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error)
        break
      }
    }
    
    console.log(`Total closed conversations to analyze: ${allConversations.length}`)
    
    const angryExamples: AngryExample[] = []
    const nearMisses: AngryExample[] = [] // Tickets with anger score 30-39
    const scoreDistribution: any = {
      '0-9': 0,
      '10-19': 0,
      '20-29': 0,
      '30-39': 0,
      '40-49': 0,
      '50-59': 0,
      '60-69': 0,
      '70-79': 0,
      '80-89': 0,
      '90-100': 0
    }
    
    // Analyze each conversation (READ-ONLY - no modifications)
    for (const conversation of allConversations) {
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
      
      // Track score distribution
      const scoreRange = Math.floor(sentiment.angerScore / 10) * 10
      const rangeKey = scoreRange >= 90 ? '90-100' : `${scoreRange}-${scoreRange + 9}`
      scoreDistribution[rangeKey]++
      
      // Look for angry customers (40+ anger score)
      if (sentiment.isAngry) {
        // Generate what the note would look like
        const notePreview = `😡 ANGRY (Anger: ${sentiment.angerScore}/100, Urgency: ${sentiment.urgencyScore}/100)
Category: ${sentiment.issueCategory}
Triggers: ${sentiment.indicators.hasProfanity ? 'Profanity, ' : ''}${sentiment.indicators.hasNegativeWords ? 'Negative Language, ' : ''}${sentiment.indicators.urgencyKeywords.length > 0 ? 'Urgency Keywords' : ''}`
        
        angryExamples.push({
          conversationId: conversation.id,
          customerEmail: conversation.primaryCustomer?.email || 'Unknown',
          subject: conversation.subject || 'No subject',
          preview: conversation.preview || '',
          urgencyScore: sentiment.urgencyScore,
          angerScore: sentiment.angerScore,
          categories: sentiment.categories,
          indicators: sentiment.indicators,
          closedAt: conversation.closedAt,
          notePreview
        })
      } else if (sentiment.angerScore >= 30 && sentiment.angerScore < 40) {
        // Track near misses
        const notePreview = `Would score ${sentiment.angerScore}/100 - just below angry threshold`
        nearMisses.push({
          conversationId: conversation.id,
          customerEmail: conversation.primaryCustomer?.email || 'Unknown',
          subject: conversation.subject || 'No subject',
          preview: conversation.preview || '',
          urgencyScore: sentiment.urgencyScore,
          angerScore: sentiment.angerScore,
          categories: sentiment.categories,
          indicators: sentiment.indicators,
          closedAt: conversation.closedAt,
          notePreview
        })
      }
    }
    
    // Sort by anger score (highest first)
    angryExamples.sort((a, b) => b.angerScore - a.angerScore)
    nearMisses.sort((a, b) => b.angerScore - a.angerScore)
    
    // Calculate percentage
    const angryPercentage = ((angryExamples.length / allConversations.length) * 100).toFixed(2)
    const nearMissPercentage = ((nearMisses.length / allConversations.length) * 100).toFixed(2)
    
    res.status(200).json({
      success: true,
      scannedCount: allConversations.length,
      totalTicketsInSystem: totalItems,
      angryCount: angryExamples.length,
      angryPercentage: `${angryPercentage}%`,
      nearMissCount: nearMisses.length,
      nearMissPercentage: `${nearMissPercentage}%`,
      scoreDistribution,
      angryExamples: angryExamples.slice(0, 20), // Top 20 angry examples
      nearMisses: nearMisses.slice(0, 10), // Top 10 near misses
      recommendation: angryExamples.length < 10 ? 
        'With only ' + angryPercentage + '% flagged as angry, you may want to lower the threshold from 40 to 30 to catch more edge cases.' : 
        'The current threshold of 40 seems appropriate.',
      message: `READ-ONLY scan of ${allConversations.length} closed tickets - no modifications made`,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Scan error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to scan closed conversations',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}