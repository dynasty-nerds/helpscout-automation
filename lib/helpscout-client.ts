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

    // Get both active and pending conversations (not closed or spam)
    const response = await axios.get(`${this.baseURL}/conversations`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      params: {
        status: 'active,pending',  // Both active and pending statuses
        embed: 'threads',
      },
    })

    return response.data
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

    await axios.put(
      `${this.baseURL}/conversations/${conversationId}/tags`,
      {
        tags: [tag],
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
  }

  async createDraftReply(conversationId: number, customerId: number, text: string) {
    await this.authenticate()

    await axios.post(
      `${this.baseURL}/conversations/${conversationId}/reply`,
      {
        customer: {
          id: customerId
        },
        text: text,
        draft: true
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
  }

  async addNote(conversationId: number, text: string) {
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