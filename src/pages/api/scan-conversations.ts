import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Placeholder for now - will implement scanning logic
  res.status(200).json({ 
    message: 'Conversation scanning endpoint',
    status: 'not implemented yet',
    timestamp: new Date().toISOString()
  })
}