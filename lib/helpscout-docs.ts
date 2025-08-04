import axios from 'axios'

interface DocsArticle {
  id: string
  title: string
  content: string
  url: string
  collectionId: string
  categoryId?: string
  status: string
  updatedAt: string
}

interface DocsCollection {
  id: string
  name: string
  description: string
  articleCount: number
}

export class HelpScoutDocsClient {
  private baseURL = 'https://docsapi.helpscout.net/v1'
  private apiKey: string

  constructor() {
    this.apiKey = process.env.HELPSCOUT_DOCS_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('HELPSCOUT_DOCS_API_KEY environment variable is required')
    }
  }

  private async makeRequest(endpoint: string, params?: any): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        auth: {
          username: this.apiKey,
          password: 'X'
        },
        headers: {
          'Content-Type': 'application/json'
        },
        params
      })
      return response.data
    } catch (error: any) {
      console.error(`HelpScout Docs API error on ${endpoint}:`, error.response?.data || error.message)
      throw error
    }
  }

  async getCollections(): Promise<DocsCollection[]> {
    const response = await this.makeRequest('/collections')
    console.log('Collections response structure:', Object.keys(response))
    
    // HelpScout Docs API v1 returns collections directly as an array
    if (Array.isArray(response)) {
      return response
    }
    
    // Try other possible response structures
    return response.collections?.items || response.collections || response.items || []
  }

  async getArticles(collectionId?: string): Promise<DocsArticle[]> {
    let articles: DocsArticle[] = []
    
    if (collectionId) {
      // Get articles from specific collection
      const data = await this.makeRequest(`/collections/${collectionId}/articles`, {
        status: 'published',
        sort: 'updated'
      })
      articles = data.articles?.items || data.articles || data.items || []
    } else {
      // Get all collections and their articles
      const collections = await this.getCollections()
      
      // Ensure collections is an array
      const collectionsArray = Array.isArray(collections) ? collections : []
      
      for (const collection of collectionsArray) {
        try {
          const data = await this.makeRequest(`/collections/${collection.id}/articles`, {
            status: 'published',
            sort: 'updated'
          })
          const articlesList = data.articles?.items || data.articles || data.items || []
          const collectionArticles = articlesList.map((article: any) => ({
            ...article,
            collectionId: collection.id
          }))
          articles.push(...collectionArticles)
        } catch (error) {
          console.error(`Failed to fetch articles for collection ${collection.id}:`, error)
          // Continue with other collections
        }
      }
    }

    return articles
  }

  async getArticle(articleId: string): Promise<DocsArticle | null> {
    try {
      const data = await this.makeRequest(`/articles/${articleId}`)
      return data.article || null
    } catch (error) {
      console.error(`Failed to fetch article ${articleId}:`, error)
      return null
    }
  }

  async searchArticles(query: string, collectionId?: string): Promise<DocsArticle[]> {
    try {
      const params: any = {
        query,
        status: 'published'
      }
      
      if (collectionId) {
        params.collectionId = collectionId
      }

      const data = await this.makeRequest('/search/articles', params)
      return data.articles?.items || data.articles || data.items || []
    } catch (error) {
      console.error(`Search failed for query "${query}":`, error)
      return []
    }
  }

  // Simple keyword-based relevance search
  findRelevantArticles(customerMessage: string, allArticles: DocsArticle[], limit: number = 3): DocsArticle[] {
    const message = customerMessage.toLowerCase()
    
    // Extract key terms
    const keyTerms = this.extractKeyTerms(message)
    
    // Score articles based on keyword matches
    const scoredArticles = allArticles.map(article => {
      let score = 0
      const articleText = (article.title + ' ' + article.content).toLowerCase()
      
      // Title matches get higher score
      keyTerms.forEach(term => {
        if (article.title.toLowerCase().includes(term)) {
          score += 10
        }
        if (articleText.includes(term)) {
          score += 1
        }
      })
      
      // Boost common support topics
      if (this.isCommonSupportTopic(message, articleText)) {
        score += 5
      }
      
      return { article, score }
    })
    
    // Return top scoring articles
    return scoredArticles
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.article)
  }

  private extractKeyTerms(message: string): string[] {
    // Remove common words and extract meaningful terms
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why', 'can', 'could', 'would', 'should', 'i', 'you', 'we', 'they', 'it', 'this', 'that', 'my', 'your']
    
    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word))
      .slice(0, 10) // Limit to top 10 terms
  }

  private isCommonSupportTopic(message: string, articleText: string): boolean {
    const supportTopics = [
      ['cancel', 'cancellation', 'subscription'],
      ['refund', 'money', 'payment', 'billing'],
      ['login', 'password', 'account', 'access'],
      ['broken', 'not working', 'error', 'bug'],
      ['upgrade', 'downgrade', 'plan', 'pricing'],
      ['draft', 'picks', 'rankings', 'players'],
      ['league', 'team', 'roster', 'waiver']
    ]
    
    return supportTopics.some(topicWords => 
      topicWords.some(word => message.includes(word) && articleText.includes(word))
    )
  }

  // Cache articles in memory (simple in-memory cache)
  private articlesCache: { articles: DocsArticle[], lastFetch: number } = { articles: [], lastFetch: 0 }
  private cacheTimeout = 60 * 60 * 1000 // 1 hour

  async getCachedArticles(): Promise<DocsArticle[]> {
    const now = Date.now()
    
    if (now - this.articlesCache.lastFetch > this.cacheTimeout || this.articlesCache.articles.length === 0) {
      console.log('Refreshing articles cache...')
      try {
        this.articlesCache.articles = await this.getArticles()
        this.articlesCache.lastFetch = now
        console.log(`Cached ${this.articlesCache.articles.length} articles`)
      } catch (error) {
        console.error('Failed to refresh articles cache:', error)
        // Return stale cache if available
      }
    }
    
    return this.articlesCache.articles
  }
}