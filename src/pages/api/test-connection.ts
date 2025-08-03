import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '@/lib/helpscout-client'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const client = new HelpScoutClient()
    await client.authenticate()
    
    res.status(200).json({ 
      success: true, 
      message: 'Successfully authenticated with HelpScout API',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('HelpScout authentication error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to authenticate with HelpScout',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}