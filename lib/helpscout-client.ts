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
  }

  async getActiveConversations() {
    await this.authenticate()

    const response = await axios.get(`${this.baseURL}/conversations`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      params: {
        status: 'active',
        embed: 'threads',
      },
    })

    return response.data
  }
}