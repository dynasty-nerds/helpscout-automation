import { NextApiRequest, NextApiResponse } from 'next';
import { fastDraftService } from '../../src/services/fastDraftService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email parameter is required' });
  }

  try {
    const result = await fastDraftService.getCodeByEmail(email);
    
    if (result.found) {
      return res.status(200).json({
        success: true,
        email: result.email,
        code: result.code,
        message: `FastDraft code found for ${email}`
      });
    } else {
      return res.status(404).json({
        success: false,
        email: result.email,
        message: result.error || 'No FastDraft code found for this email'
      });
    }
  } catch (error: any) {
    console.error('Error in FastDraft API:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}