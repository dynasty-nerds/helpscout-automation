import { NextApiRequest, NextApiResponse } from 'next'
import { ClaudeClient } from '../../lib/claude-client'
import { HelpScoutDocsClient } from '../../lib/helpscout-docs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const results = {
    claudeApiKey: !!process.env.CLAUDE_API_KEY,
    docsApiKey: !!process.env.HELPSCOUT_DOCS_API_KEY,
    claudeClient: false,
    docsClient: false,
    claudeError: null as string | null,
    docsError: null as string | null,
  }

  // Test Claude client
  try {
    const claude = new ClaudeClient()
    results.claudeClient = true
  } catch (error: any) {
    results.claudeError = error.message
  }

  // Test Docs client
  try {
    const docs = new HelpScoutDocsClient()
    results.docsClient = true
  } catch (error: any) {
    results.docsError = error.message
  }

  res.status(200).json(results)
}