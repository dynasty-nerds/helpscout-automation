import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const client = new HelpScoutClient()
    
    // Test ticket IDs
    const testTickets = [2928025395, 3023420232, 2620095977]
    const ticketInfo: any[] = []
    
    for (const ticketId of testTickets) {
      try {
        // Get conversation details
        const response = await client.getActiveConversations()
        const conversation = response._embedded?.conversations?.find((c: any) => c.id === ticketId)
        
        // Get conversation threads
        const threadsData = await client.getConversationThreads(ticketId)
        const threads = threadsData._embedded?.threads || []
        
        // Find notes and drafts
        const notes = threads.filter((thread: any) => thread.type === 'note')
        const drafts = threads.filter((thread: any) => thread.type === 'reply' && thread.state === 'draft')
        const aiNotes = notes.filter((note: any) => 
          note.body?.includes('AI Draft Reply') ||
          note.body?.includes('ANGRY') ||
          note.body?.includes('HIGH URGENCY') ||
          note.body?.includes('Urgency:')
        )
        
        ticketInfo.push({
          ticketId,
          subject: conversation?.subject || 'Not found',
          tags: conversation?.tags || [],
          totalNotes: notes.length,
          aiNotes: aiNotes.length,
          drafts: drafts.length,
          latestAINote: aiNotes[0] ? {
            createdAt: aiNotes[0].createdAt,
            preview: aiNotes[0].body?.substring(0, 200) + '...'
          } : null,
          hasDraft: drafts.length > 0
        })
      } catch (error) {
        ticketInfo.push({
          ticketId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    res.status(200).json({
      success: true,
      testTickets: ticketInfo,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Check tickets error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to check tickets',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}