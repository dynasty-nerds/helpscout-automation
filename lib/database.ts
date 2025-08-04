import { Pool, PoolClient } from 'pg'

// Database connection pool
let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }
  return pool
}

// Helper function for database queries
export async function query(text: string, params?: any[]): Promise<any> {
  const pool = getPool()
  const start = Date.now()
  
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms):`, text.substring(0, 100))
    }
    
    return res
  } catch (error) {
    console.error('Database query error:', error)
    console.error('Query:', text)
    console.error('Params:', params)
    throw error
  }
}

// Helper function for transactions
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool()
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Database models for our AI system
export class ProcessedThreadsModel {
  static async isProcessed(conversationId: number, threadId: number): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM processed_threads WHERE conversation_id = $1 AND thread_id = $2',
      [conversationId, threadId]
    )
    return result.rows.length > 0
  }

  static async markProcessed(
    conversationId: number, 
    threadId: number, 
    threadType: string,
    processingResult?: any
  ): Promise<void> {
    await query(
      `INSERT INTO processed_threads (conversation_id, thread_id, thread_type, processing_result) 
       VALUES ($1, $2, $3, $4) ON CONFLICT (conversation_id, thread_id) DO NOTHING`,
      [conversationId, threadId, threadType, JSON.stringify(processingResult)]
    )
  }

  static async getRecentlyProcessed(hours: number = 24): Promise<any[]> {
    const result = await query(
      `SELECT * FROM processed_threads 
       WHERE processed_at > NOW() - INTERVAL '${hours} hours' 
       ORDER BY processed_at DESC`,
      []
    )
    return result.rows
  }
}

export class DocumentationModel {
  static async upsertArticle(article: {
    articleId: string
    collectionId?: string
    title: string
    content: string
    url?: string
    category?: string
    tags?: string[]
    lastUpdated?: Date
    embedding?: number[]
  }): Promise<void> {
    await query(
      `INSERT INTO documentation_cache 
       (article_id, collection_id, title, content, url, category, tags, last_updated, embedding, word_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (article_id) DO UPDATE SET
         collection_id = EXCLUDED.collection_id,
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         url = EXCLUDED.url,
         category = EXCLUDED.category,
         tags = EXCLUDED.tags,
         last_updated = EXCLUDED.last_updated,
         embedding = EXCLUDED.embedding,
         word_count = EXCLUDED.word_count,
         cached_at = CURRENT_TIMESTAMP`,
      [
        article.articleId,
        article.collectionId,
        article.title,
        article.content,
        article.url,
        article.category,
        article.tags,
        article.lastUpdated,
        article.embedding ? `[${article.embedding.join(',')}]` : null,
        article.content.split(' ').length
      ]
    )
  }

  static async findSimilarArticles(embedding: number[], limit: number = 5): Promise<any[]> {
    const result = await query(
      `SELECT article_id, title, content, url, category, 
              (embedding <=> $1::vector) as similarity
       FROM documentation_cache 
       WHERE is_active = true AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [`[${embedding.join(',')}]`, limit]
    )
    return result.rows
  }

  static async getAllArticles(): Promise<any[]> {
    const result = await query(
      'SELECT * FROM documentation_cache WHERE is_active = true ORDER BY title',
      []
    )
    return result.rows
  }

  static async searchByKeywords(keywords: string[]): Promise<any[]> {
    const searchTerms = keywords.map(k => `%${k.toLowerCase()}%`)
    const whereConditions = keywords.map((_, i) => 
      `(LOWER(title) LIKE $${i + 1} OR LOWER(content) LIKE $${i + 1})`
    ).join(' OR ')
    
    const result = await query(
      `SELECT * FROM documentation_cache 
       WHERE is_active = true AND (${whereConditions})
       ORDER BY 
         CASE WHEN ${keywords.map((_, i) => `LOWER(title) LIKE $${i + 1}`).join(' OR ')} THEN 1 ELSE 2 END,
         title`,
      searchTerms
    )
    return result.rows
  }
}

export class ResponseSuggestionsModel {
  static async create(suggestion: {
    conversationId: number
    threadId: number
    customerMessage: string
    suggestedResponse: string
    confidenceScore: number
    reasoning: string
    referencedDocs: string[]
    responseType: string
    modelUsed?: string
    tokensUsed: number
    costCents: number
  }): Promise<number> {
    const result = await query(
      `INSERT INTO response_suggestions 
       (conversation_id, thread_id, customer_message, suggested_response, confidence_score, 
        reasoning, referenced_docs, response_type, model_used, tokens_used, cost_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        suggestion.conversationId,
        suggestion.threadId,
        suggestion.customerMessage,
        suggestion.suggestedResponse,
        suggestion.confidenceScore,
        suggestion.reasoning,
        suggestion.referencedDocs,
        suggestion.responseType,
        suggestion.modelUsed || 'claude-3.5-sonnet',
        suggestion.tokensUsed,
        suggestion.costCents
      ]
    )
    return result.rows[0].id
  }

  static async getForConversation(conversationId: number): Promise<any[]> {
    const result = await query(
      `SELECT * FROM response_suggestions 
       WHERE conversation_id = $1 AND is_active = true 
       ORDER BY created_at DESC`,
      [conversationId]
    )
    return result.rows
  }

  static async getRecent(limit: number = 50): Promise<any[]> {
    const result = await query(
      `SELECT rs.*, ar.modification_type, ar.feedback_score
       FROM response_suggestions rs
       LEFT JOIN agent_responses ar ON rs.id = ar.suggestion_id
       ORDER BY rs.created_at DESC
       LIMIT $1`,
      [limit]
    )
    return result.rows
  }
}

export class AgentResponsesModel {
  static async trackResponse(response: {
    suggestionId: number
    conversationId: number
    threadId: number
    actualResponse: string
    agentId?: number
    agentEmail?: string
    modifications?: string
    modificationType: string
    feedbackScore?: number
    feedbackNotes?: string
    responseTimeMinutes?: number
  }): Promise<void> {
    await query(
      `INSERT INTO agent_responses 
       (suggestion_id, conversation_id, thread_id, actual_response, agent_id, agent_email,
        modifications, modification_type, feedback_score, feedback_notes, response_time_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        response.suggestionId,
        response.conversationId,
        response.threadId,
        response.actualResponse,
        response.agentId,
        response.agentEmail,
        response.modifications,
        response.modificationType,
        response.feedbackScore,
        response.feedbackNotes,
        response.responseTimeMinutes
      ]
    )
  }

  static async getAnalytics(days: number = 30): Promise<any> {
    const result = await query(
      `SELECT 
         COUNT(*) as total_responses,
         AVG(feedback_score) as avg_feedback_score,
         COUNT(CASE WHEN modification_type = 'no_change' THEN 1 END) as accepted_suggestions,
         COUNT(CASE WHEN modification_type = 'minor' THEN 1 END) as minor_modifications,
         COUNT(CASE WHEN modification_type = 'major' THEN 1 END) as major_modifications,
         COUNT(CASE WHEN modification_type = 'complete_rewrite' THEN 1 END) as complete_rewrites,
         AVG(response_time_minutes) as avg_response_time
       FROM agent_responses 
       WHERE created_at > NOW() - INTERVAL '${days} days'`,
      []
    )
    return result.rows[0]
  }
}

export class DocumentationGapsModel {
  static async recordGap(gap: {
    conversationId?: number
    threadId?: number
    suggestedTopic: string
    gapDescription: string
    priority?: string
  }): Promise<void> {
    // Check if similar gap already exists
    const existing = await query(
      'SELECT id FROM documentation_gaps WHERE suggested_topic ILIKE $1 AND status = $2',
      [`%${gap.suggestedTopic}%`, 'open']
    )

    if (existing.rows.length > 0) {
      // Increment frequency count
      await query(
        'UPDATE documentation_gaps SET frequency_count = frequency_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [existing.rows[0].id]
      )
    } else {
      // Create new gap record
      await query(
        `INSERT INTO documentation_gaps 
         (conversation_id, thread_id, suggested_topic, gap_description, priority)
         VALUES ($1, $2, $3, $4, $5)`,
        [gap.conversationId, gap.threadId, gap.suggestedTopic, gap.gapDescription, gap.priority || 'medium']
      )
    }
  }

  static async getTopGaps(limit: number = 10): Promise<any[]> {
    const result = await query(
      `SELECT * FROM documentation_gaps 
       WHERE status = 'open' 
       ORDER BY frequency_count DESC, priority DESC, created_at DESC 
       LIMIT $1`,
      [limit]
    )
    return result.rows
  }
}

// Utility function to initialize database
export async function initializeDatabase(): Promise<void> {
  try {
    // Test connection
    await query('SELECT NOW()')
    console.log('Database connection successful')
    
    // You can add any initialization logic here
    // For now, just ensure the schema is applied (manually)
    
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}