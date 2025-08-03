# Setting Up the High Urgency View

**Type**: Documentation

## Overview
The system now identifies high urgency tickets based on multiple factors, not just anger. We use tags to categorize and prioritize tickets appropriately.

## Tag System

### 1. Primary Tags
- **high-urgency**: Any ticket requiring immediate attention
- **angry**: Customer showing anger through profanity, negative language, or shouting

### 2. Score Tags
- **urgency-score-XX**: Tracks urgency level (0-100)
- **anger-score-XX**: Tracks anger level (0-100)

### 3. When Tags Are Applied
The system tags conversations as high-urgency when:
- Subscription/billing issues mentioned (refund, cancel, charged)
- Urgent keywords used (immediately, now, asap)
- Customer is angry (profanity, negative language, caps)
- Multiple attempts or long wait times mentioned

### 2. Configure Your High Urgency View
In HelpScout, update your view to include these filters:
- **Status**: Active
- **Tags**: Contains "high-urgency"
- **Sort by**: Updated (most recent activity) or Created (newest first)

### 3. Optional Additional Filters
You might also want to add:
- **Assigned to**: Unassigned (to catch tickets not yet claimed)
- **Waiting Since**: More than X hours (for urgent follow-up)

## How It Works

1. **Cron Job** runs every 15 minutes during business hours
2. **Scans** all active conversations
3. **Analyzes** sentiment using our scoring algorithm
4. **Tags** high-anger conversations with "angry-customer"
5. **View** automatically shows tagged conversations

## API Endpoints

- `/api/scan-conversations` - Scans and returns angry customers (read-only)
- `/api/scan-and-tag` - Scans and tags angry customers
- `/api/test-connection` - Tests HelpScout API connection

## Manual Testing

To manually run the scanner and tag conversations:
```
https://helpscout-automation.vercel.app/api/scan-and-tag
```

## Monitoring

Check the response to see:
- How many conversations were scanned
- How many angry customers were found
- How many were successfully tagged
- Top 10 angriest customers with scores