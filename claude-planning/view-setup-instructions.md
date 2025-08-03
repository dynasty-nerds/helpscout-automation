# Setting Up the Angry Customers View

**Type**: Documentation

## Overview
Since HelpScout uses Views (saved searches) rather than folders for organizing conversations, we'll use tags to identify angry customers and filter them in your view.

## Setup Instructions

### 1. Tag Configuration
The system will automatically tag conversations with `angry-customer` when:
- Anger score is 50 or higher
- Contains profanity, urgency keywords, or service complaints
- Mentions refunds, cancellations, or money back

### 2. Configure Your "Angry Customers" View
In HelpScout, edit your Angry Customers view to include these filters:
- **Status**: Active
- **Tags**: Contains "angry-customer"
- **Sort by**: Created (newest first) or Updated (most recent activity)

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