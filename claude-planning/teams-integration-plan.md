# Microsoft Teams Integration for HelpScout Alerts

**Type**: Implementation Plan

## Overview
Send notifications to Microsoft Teams channel when high-urgency or angry customer tickets are detected and tagged.

## User Need
- Immediate notification when urgent/angry tickets are found
- Allow team to quickly see ticket details and claim tickets
- Reduce response time for critical customer issues

## Implementation Steps

### 1. Set up Teams Webhook
- Create incoming webhook in Teams channel
- Get webhook URL from Teams
- Store as environment variable in Vercel

### 2. Create Teams Notification Service
- Format rich card with ticket details
- Include customer info, urgency/anger scores, and triggers
- Add "View Ticket" button linking to HelpScout

### 3. Integration Points
- Send notification after tagging ticket
- Only send for new tags (not if ticket already tagged)
- Include different colors for angry vs urgent

### 4. Message Format
```json
{
  "type": "message",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "type": "AdaptiveCard",
      "body": [
        {
          "type": "TextBlock",
          "text": "🚨 HIGH URGENCY TICKET",
          "weight": "Bolder",
          "color": "Attention"
        },
        {
          "type": "FactSet",
          "facts": [
            {"title": "Customer", "value": "email@example.com"},
            {"title": "Subject", "value": "Ticket subject"},
            {"title": "Urgency Score", "value": "85/100"},
            {"title": "Triggers", "value": "Profanity, Subscription Issues"}
          ]
        }
      ],
      "actions": [
        {
          "type": "Action.OpenUrl",
          "title": "View in HelpScout",
          "url": "https://secure.helpscout.net/conversation/123"
        }
      ]
    }
  }]
}
```

## Testing Plan
- Test with both angry and urgent tickets
- Verify webhook deliverability
- Test card formatting and buttons
- Ensure no duplicate notifications

## Notes
- Only notify on newly tagged tickets
- Different card colors for angry (red) vs urgent (orange)
- Include preview of customer message