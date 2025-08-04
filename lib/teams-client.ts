import axios from 'axios'

interface TeamsNotification {
  conversationId: number
  noteText: string
  customerEmail: string
  subject: string
}

export class TeamsClient {
  private webhookUrl: string

  constructor() {
    this.webhookUrl = process.env.TEAMS_WEBHOOK_URL || ''
    if (!this.webhookUrl) {
      throw new Error('TEAMS_WEBHOOK_URL environment variable is required')
    }
  }

  async sendUrgentTicketAlert(notification: TeamsNotification): Promise<void> {
    const card = {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.3',
          body: [
            {
              type: 'TextBlock',
              text: `🚨 URGENT TICKET: ${notification.subject}`,
              weight: 'Bolder',
              size: 'Medium',
              color: 'Attention'
            },
            {
              type: 'TextBlock',
              text: `Customer: ${notification.customerEmail}`,
              weight: 'Bolder'
            },
            {
              type: 'TextBlock',
              text: notification.noteText,
              wrap: true,
              fontType: 'Monospace'
            }
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'View in HelpScout',
              url: `https://secure.helpscout.net/conversation/${notification.conversationId}`
            }
          ]
        }
      }]
    }

    try {
      await axios.post(this.webhookUrl, card, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      console.log(`Teams notification sent for conversation ${notification.conversationId}`)
    } catch (error: any) {
      console.error(`Failed to send Teams notification for ${notification.conversationId}:`, error.response?.data || error.message)
      throw error
    }
  }

}