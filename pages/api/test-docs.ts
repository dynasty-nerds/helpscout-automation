import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutDocsClient } from '../../lib/helpscout-docs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const docsClient = new HelpScoutDocsClient()
    
    // Get collections
    const collections = await docsClient.getCollections()
    
    // Get cached articles
    const articles = await docsClient.getCachedArticles()
    
    // Test search
    const testMessage = req.query.message as string || 'I want to cancel my subscription'
    const relevantDocs = docsClient.findRelevantArticles(testMessage, articles, 3)
    
    res.status(200).json({
      success: true,
      collectionsFound: collections.length,
      collections: collections.map(c => ({ id: c.id, name: c.name, articleCount: c.articleCount })),
      articlesFound: articles.length,
      sampleArticles: articles.slice(0, 3).map(a => ({ 
        id: a.id, 
        name: a.name, 
        url: a.publicUrl,
        textLength: a.text?.length || 0
      })),
      searchTest: {
        query: testMessage,
        resultsFound: relevantDocs.length,
        results: relevantDocs.map(doc => ({
          name: doc.name,
          url: doc.publicUrl
        }))
      }
    })
  } catch (error: any) {
    console.error('Error testing docs:', error)
    res.status(500).json({ 
      success: false,
      error: error.message,
      hint: error.message.includes('HELPSCOUT_DOCS_API_KEY') 
        ? 'Make sure HELPSCOUT_DOCS_API_KEY is set in your .env file' 
        : undefined
    })
  }
}