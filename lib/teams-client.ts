import axios from 'axios'

interface TeamsNotification {
  conversationId: number
  customerEmail: string
  subject: string
  preview: string
  urgencyScore: number
  angerScore: number
  isAngry: boolean
  isHighUrgency: boolean
  triggers: string[]
  categories: string[]
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
    const cardColor = notification.isAngry ? 'Attention' : 'Warning' // Red for angry, orange for urgent
    const emoji = notification.isAngry ? '😡' : '❗'
    const type = notification.isAngry ? 'ANGRY CUSTOMER' : 'HIGH URGENCY'
    
    // Format triggers for display
    const triggersList = notification.triggers.length > 0 
      ? notification.triggers.join(', ') 
      : 'Keyword detection'

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
              text: `${emoji} ${type} DETECTED`,
              weight: 'Bolder',
              size: 'Medium',
              color: cardColor
            },
            {
              type: 'TextBlock',
              text: notification.subject,
              weight: 'Bolder',
              wrap: true
            },
            {
              type: 'TextBlock',
              text: notification.preview.substring(0, 200) + (notification.preview.length > 200 ? '...' : ''),
              wrap: true,
              isSubtle: true
            },
            {
              type: 'FactSet',
              facts: [
                {
                  title: 'Customer',
                  value: notification.customerEmail
                },
                {
                  title: 'Urgency Score',
                  value: `${notification.urgencyScore}/100`
                },
                {
                  title: 'Anger Score', 
                  value: `${notification.angerScore}/100`
                },
                {
                  title: 'Triggers',
                  value: triggersList
                },
                {
                  title: 'Categories',
                  value: notification.categories.join(', ')
                }
              ]
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

  async sendSpamAlert(notification: { conversationId: number, customerEmail: string, subject: string, confidence: string }): Promise<void> {
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
              text: `🗑️ SPAM DETECTED (${notification.confidence} confidence)`,
              weight: 'Bolder',
              size: 'Medium',
              color: 'Good'
            },
            {
              type: 'FactSet',
              facts: [
                {
                  title: 'Customer',
                  value: notification.customerEmail
                },
                {
                  title: 'Subject',
                  value: notification.subject
                },
                {
                  title: 'Confidence',
                  value: notification.confidence
                }
              ]
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
      await axios.post(this.webhookUrl, card)
      console.log(`Teams spam notification sent for conversation ${notification.conversationId}`)
    } catch (error: any) {
      console.error(`Failed to send Teams spam notification for ${notification.conversationId}:`, error.response?.data || error.message)
      throw error
    }
  }
}