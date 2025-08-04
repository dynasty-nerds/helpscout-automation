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
    // Simple JSON payload for Power Automate workflow
    const payload = {
      title: `🚨 URGENT TICKET: ${notification.subject}`,
      customer: notification.customerEmail,
      noteText: notification.noteText,
      ticketUrl: `https://secure.helpscout.net/conversation/${notification.conversationId}`,
      conversationId: notification.conversationId
    }

    try {
      await axios.post(this.webhookUrl, payload, {
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