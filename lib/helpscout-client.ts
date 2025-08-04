import axios from 'axios'

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export class HelpScoutClient {
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null
  private baseURL = 'https://api.helpscout.net/v2'

  async authenticate(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return
    }

    try {
      const response = await axios.post<TokenResponse>(
        'https://api.helpscout.net/v2/oauth2/token',
        {
          grant_type: 'client_credentials',
          client_id: process.env.HELPSCOUT_APP_ID,
          client_secret: process.env.HELPSCOUT_APP_SECRET,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      this.accessToken = response.data.access_token
      this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000)
    } catch (error: any) {
      console.error('HelpScout authentication failed:', error.response?.data || error.message)
      throw new Error(`HelpScout auth failed: ${error.response?.data?.error_description || error.message}`)
    }
  }

  async getActiveConversations() {
    await this.authenticate()

    let allConversations: any[] = []
    let page = 1
    let hasMore = true

    // Fetch all pages of conversations
    while (hasMore) {
      console.log(`Fetching conversations page ${page}...`)
      const response = await axios.get(`${this.baseURL}/conversations`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        params: {
          status: 'active,pending',  // Both active and pending statuses
          embed: 'threads',
          page: page,
          size: 50,  // Use 50 per page for better performance
        },
      })

      const conversations = response.data._embedded?.conversations || []
      allConversations = allConversations.concat(conversations)
      
      console.log(`Page ${page} returned ${conversations.length} conversations`)
      
      // Check if there are more pages
      const totalPages = response.data.page?.totalPages || 1
      hasMore = page < totalPages
      page++
      
      // Safety limit to prevent infinite loops
      if (page > 10) {
        console.log('Reached page limit of 10')
        break
      }
    }

    console.log(`Total conversations fetched: ${allConversations.length}`)
    
    // Return in the same format as before
    return {
      _embedded: {
        conversations: allConversations
      }
    }
  }

  async getClosedConversations(page: number = 1) {
    await this.authenticate()

    const response = await axios.get(`${this.baseURL}/conversations`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      params: {
        status: 'closed',
        embed: 'threads',
        sortField: 'modifiedAt',
        sortOrder: 'desc',
        page: page,
        size: 50  // Max per page
      },
    })

    return response.data
  }

  async getConversationThreads(conversationId: number) {
    await this.authenticate()

    try {
      const response = await axios.get(`${this.baseURL}/conversations/${conversationId}/threads`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      return response.data
    } catch (error: any) {
      console.error(`Failed to get conversation threads ${conversationId}:`, error.response?.data || error.message)
      throw error
    }
  }

  async getFolders(mailboxId: number) {
    await this.authenticate()

    const response = await axios.get(`${this.baseURL}/mailboxes/${mailboxId}/folders`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    return response.data
  }

  async moveConversation(conversationId: number, folderId: number) {
    await this.authenticate()

    await axios.patch(
      `${this.baseURL}/conversations/${conversationId}`,
      {
        op: 'move',
        path: '/folderId',
        value: folderId,
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
  }

  async addTag(conversationId: number, tag: string) {
    await this.authenticate()

    // First get existing tags
    const conversation = await axios.get(
      `${this.baseURL}/conversations/${conversationId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    )

    const existingTags = conversation.data.tags || []
    
    // Check if tag already exists (tags can be strings or objects with tag property)
    const tagStrings: string[] = []
    let tagAlreadyExists = false
    
    existingTags.forEach((t: any) => {
      let tagName: string | null = null
      
      if (typeof t === 'string') {
        tagName = t
      } else if (t && typeof t === 'object' && t.tag) {
        tagName = t.tag
      }
      
      if (tagName) {
        tagStrings.push(tagName)
        if (tagName === tag) {
          tagAlreadyExists = true
        }
      }
    })
    
    if (!tagAlreadyExists) {
      // Add new tag to the list
      const updatedTags = [...tagStrings, tag]
      
      console.log(`Adding tag ${tag} to conversation ${conversationId}. Updated tags:`, updatedTags)
      
      // Update with all tags as strings
      try {
        await axios.put(
          `${this.baseURL}/conversations/${conversationId}/tags`,
          {
            tags: updatedTags,
          },
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        )
        console.log(`Successfully added tag ${tag} to conversation ${conversationId}`)
      } catch (error: any) {
        console.error(`Failed to add tag to conversation ${conversationId}:`, error.response?.data || error.message)
        if (error.response?.data) {
          console.error('Request data:', JSON.stringify({ tags: updatedTags }))
        }
        throw error
      }
    } else {
      console.log(`Tag ${tag} already exists on conversation ${conversationId}, skipping`)
    }
  }

  async createDraftReply(conversationId: number, customerId: number, text: string, status?: string, assignTo?: number | null) {
    await this.authenticate()

    const requestData: any = {
      customer: {
        id: customerId
      },
      text: text,
      draft: true
    }

    // Set status if provided (e.g., 'closed')
    if (status) {
      requestData.status = status
    }

    // Set assignee - only include if we have a valid user ID
    // Try setting to null explicitly for unassigned
    if (assignTo !== undefined) {
      if (assignTo === 0 || assignTo === null) {
        requestData.assignTo = null
      } else if (assignTo > 0) {
        requestData.assignTo = assignTo
      }
    }

    await axios.post(
      `${this.baseURL}/conversations/${conversationId}/reply`,
      requestData,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
  }

  async addNote(conversationId: number, text: string, preserveStatus: boolean = false, currentStatus?: string) {
    await this.authenticate()

    await axios.post(
      `${this.baseURL}/conversations/${conversationId}/notes`,
      {
        text,
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
    
    // If we need to preserve the status, update it back to what it was
    if (preserveStatus && currentStatus) {
      await this.updateConversationStatus(conversationId, currentStatus)
    }
  }

  async updateConversationStatus(conversationId: number, status: string) {
    await this.authenticate()

    await axios.patch(
      `${this.baseURL}/conversations/${conversationId}`,
      {
        op: 'replace',
        path: '/status',
        value: status,
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
  }

  async getMailboxes() {
    await this.authenticate()

    const response = await axios.get(`${this.baseURL}/mailboxes`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    return response.data
  }
}