import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const client = new HelpScoutClient()
    
    // Test ticket IDs
    const testTickets = [2928025395, 3023420232, 2620095977]
    const cleared: number[] = []
    const errors: any[] = []
    
    for (const ticketId of testTickets) {
      try {
        // Get conversation threads
        const threadsData = await client.getConversationThreads(ticketId)
        const threads = threadsData._embedded?.threads || []
        
        // Find AI-generated notes
        const aiNotes = threads.filter((thread: any) => 
          thread.type === 'note' && (
            thread.body?.includes('AI Draft Reply') ||
            thread.body?.includes('ANGRY') ||
            thread.body?.includes('HIGH URGENCY') ||
            thread.body?.includes('Urgency:') ||
            thread.body?.includes('Claude Usage:')
          )
        )
        
        console.log(`Found ${aiNotes.length} AI notes in ticket ${ticketId}`)
        
        // Note: HelpScout API doesn't support deleting notes
        // This endpoint is just for checking what notes exist
        cleared.push(ticketId)
      } catch (error) {
        console.error(`Error processing ticket ${ticketId}:`, error)
        errors.push({ ticketId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Note: HelpScout API does not support deleting notes. You must manually delete them in the HelpScout interface.',
      testTickets,
      processed: cleared,
      errors,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Clear notes error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}