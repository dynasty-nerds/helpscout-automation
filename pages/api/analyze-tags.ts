import { NextApiRequest, NextApiResponse } from 'next'
import { HelpScoutClient } from '../../lib/helpscout-client'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const client = new HelpScoutClient()
    
    // Get all tags from HelpScout
    console.log('Fetching all tags from HelpScout...')
    const allTags: any[] = []
    let page = 1
    let hasMore = true
    
    while (hasMore) {
      const response = await client.getTags(page)
      if (response._embedded?.tags) {
        allTags.push(...response._embedded.tags)
      }
      
      // Check if there are more pages
      if (response.page && response.page.totalPages > page) {
        page++
      } else {
        hasMore = false
      }
    }
    
    console.log(`Found ${allTags.length} total tags`)
    
    // Analyze tags
    const analysis = {
      totalTags: allTags.length,
      tags: allTags.sort((a, b) => b.ticketCount - a.ticketCount), // Sort by usage
      
      // Group by patterns
      categories: {
        platforms: allTags.filter(t => 
          /espn|sleeper|mfl|yahoo|fleaflicker|ffpc/i.test(t.name)
        ),
        issues: allTags.filter(t => 
          /bug|error|issue|problem|broken|crash/i.test(t.name)
        ),
        billing: allTags.filter(t => 
          /refund|cancel|billing|payment|subscription|charge/i.test(t.name)
        ),
        features: allTags.filter(t => 
          /feature|request|suggestion|wish|want/i.test(t.name)
        ),
        sentiment: allTags.filter(t => 
          /angry|urgent|spam|frustrated|upset/i.test(t.name)
        ),
        access: allTags.filter(t => 
          /access|login|premium|locked|signin/i.test(t.name)
        ),
        sync: allTags.filter(t => 
          /sync|update|refresh|roster|league/i.test(t.name)
        ),
        draft: allTags.filter(t => 
          /draft|pick|rookie|mock/i.test(t.name)
        ),
        dates: allTags.filter(t => 
          /\d{4}|\d{1,2}\/\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december/i.test(t.name)
        ),
        customerNames: allTags.filter(t => 
          /^[A-Z][a-z]+\s[A-Z][a-z]+$/.test(t.name) || // Looks like a person's name
          /@/.test(t.name) // Contains email
        ),
        unused: allTags.filter(t => t.ticketCount === 0),
        lowUsage: allTags.filter(t => t.ticketCount > 0 && t.ticketCount <= 5),
        highUsage: allTags.filter(t => t.ticketCount > 50)
      },
      
      // Potential duplicates (similar names)
      potentialDuplicates: findPotentialDuplicates(allTags),
      
      // Recommendations
      recommendations: generateRecommendations(allTags)
    }
    
    return res.status(200).json(analysis)
    
  } catch (error: any) {
    console.error('Failed to analyze tags:', error)
    return res.status(500).json({ 
      error: 'Failed to analyze tags', 
      details: error.message 
    })
  }
}

function findPotentialDuplicates(tags: any[]): any[] {
  const duplicates: any[] = []
  
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const tag1 = tags[i].name.toLowerCase()
      const tag2 = tags[j].name.toLowerCase()
      
      // Check for very similar names
      if (
        tag1.includes(tag2) || 
        tag2.includes(tag1) ||
        levenshteinDistance(tag1, tag2) <= 2 ||
        (tag1.replace(/[-_\s]/g, '') === tag2.replace(/[-_\s]/g, ''))
      ) {
        duplicates.push({
          tag1: tags[i],
          tag2: tags[j],
          combinedTickets: tags[i].ticketCount + tags[j].ticketCount
        })
      }
    }
  }
  
  return duplicates
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

function generateRecommendations(tags: any[]): string[] {
  const recommendations: string[] = []
  
  const unusedCount = tags.filter(t => t.ticketCount === 0).length
  if (unusedCount > 0) {
    recommendations.push(`Delete ${unusedCount} unused tags (0 tickets)`)
  }
  
  const lowUsageCount = tags.filter(t => t.ticketCount > 0 && t.ticketCount <= 5).length
  if (lowUsageCount > 20) {
    recommendations.push(`Review ${lowUsageCount} low-usage tags (1-5 tickets) for consolidation`)
  }
  
  const dateTagCount = tags.filter(t => /\d{4}|\d{1,2}\/\d{1,2}/.test(t.name)).length
  if (dateTagCount > 10) {
    recommendations.push(`Remove ${dateTagCount} date-specific tags (use notes instead)`)
  }
  
  const nameTagCount = tags.filter(t => /@/.test(t.name) || /^[A-Z][a-z]+\s[A-Z][a-z]+$/.test(t.name)).length
  if (nameTagCount > 0) {
    recommendations.push(`Remove ${nameTagCount} customer name/email tags (privacy concern)`)
  }
  
  return recommendations
}