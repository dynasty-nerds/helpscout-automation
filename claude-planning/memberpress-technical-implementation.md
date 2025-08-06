# MemberPress Technical Implementation Guide

**Type**: Implementation Plan

## Overview
Step-by-step technical guide for integrating MemberPress database queries into the Help Scout AI assistant.

## Implementation Steps

### 1. Create MemberPress Service Module
Create `src/services/memberPressService.ts`:

```typescript
import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';

interface Transaction {
  id: number;
  user_id: number;
  subscription_id: number;
  status: string;
  gateway: string;
  total: number;
  created_at: Date;
  expires_at?: Date;
}

interface Subscription {
  id: number;
  user_id: number;
  product_id: number;
  gateway: string;
  status: string;
  period_type: 'months' | 'years';
  period: number;
}

class MemberPressService {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.MEMBERPRESS_DB_HOST || '165.227.87.17',
      port: parseInt(process.env.MEMBERPRESS_DB_PORT || '3306'),
      database: process.env.MEMBERPRESS_DB_NAME || 'dynastyn_Dynastynerds',
      user: process.env.MEMBERPRESS_DB_USER || 'nick_readonly',
      password: process.env.MEMBERPRESS_DB_PASSWORD,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0
    });
  }

  async getUserIdByEmail(email: string): Promise<number | null> {
    const [rows] = await this.pool.execute(
      'SELECT ID FROM sri_users WHERE user_email = ?',
      [email.toLowerCase()]
    );
    return rows[0]?.ID || null;
  }

  async hasActiveTransaction(email: string): Promise<{
    isActive: boolean;
    subscription?: any;
    expiresAt?: Date;
  }> {
    const userId = await this.getUserIdByEmail(email);
    if (!userId) return { isActive: false };

    const query = `
      SELECT 
        t.*,
        s.gateway,
        s.period_type,
        s.period,
        s.product_id,
        p.post_title as product_name,
        CASE 
          WHEN s.period_type = 'months' THEN DATE_ADD(t.created_at, INTERVAL 30 DAY)
          WHEN s.period_type = 'years' THEN DATE_ADD(t.created_at, INTERVAL 365 DAY)
        END as expires_at
      FROM sri_mepr_transactions t
      JOIN sri_mepr_subscriptions s ON t.subscription_id = s.id
      LEFT JOIN sri_posts p ON s.product_id = p.ID
      WHERE t.user_id = ?
        AND t.status = 'complete'
        AND (
          (s.period_type = 'months' AND DATE_ADD(t.created_at, INTERVAL 30 DAY) > NOW())
          OR (s.period_type = 'years' AND DATE_ADD(t.created_at, INTERVAL 365 DAY) > NOW())
        )
      ORDER BY t.created_at DESC
      LIMIT 1
    `;

    const [rows] = await this.pool.execute(query, [userId]);
    
    if (rows.length > 0) {
      const transaction = rows[0];
      return {
        isActive: true,
        subscription: {
          type: this.getSubscriptionType(transaction.product_name, transaction.period_type),
          gateway: transaction.gateway,
          amount: transaction.total,
          productId: transaction.product_id
        },
        expiresAt: transaction.expires_at
      };
    }

    return { isActive: false };
  }

  async getTransactionHistory(email: string, limit: number = 10): Promise<Transaction[]> {
    const userId = await this.getUserIdByEmail(email);
    if (!userId) return [];

    const query = `
      SELECT 
        t.*,
        s.gateway,
        s.period_type,
        p.post_title as product_name
      FROM sri_mepr_transactions t
      JOIN sri_mepr_subscriptions s ON t.subscription_id = s.id
      LEFT JOIN sri_posts p ON s.product_id = p.ID
      WHERE t.user_id = ?
        AND t.status IN ('complete', 'refunded')
      ORDER BY t.created_at DESC
      LIMIT ?
    `;

    const [rows] = await this.pool.execute(query, [userId, limit]);
    return rows as Transaction[];
  }

  private getSubscriptionType(productName: string, periodType: string): string {
    if (!productName) return 'Unknown';
    
    const nameLower = productName.toLowerCase();
    const isMonthly = periodType === 'months';
    
    if (nameLower.includes('nerdherd') && nameLower.includes('dynastygm')) {
      return isMonthly ? 'Bundle Monthly' : 'Bundle Yearly';
    } else if (nameLower.includes('dynastygm') && !nameLower.includes('nerdherd')) {
      return isMonthly ? 'GM Only Monthly' : 'GM Only Yearly';
    } else if (nameLower.includes('nerdherd') && !nameLower.includes('dynastygm')) {
      return isMonthly ? 'NerdHerd Only Monthly' : 'NerdHerd Only Yearly';
    }
    
    return productName;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const memberPressService = new MemberPressService();
```

### 2. Update Environment Variables
Add to `.env`:
```
MEMBERPRESS_DB_HOST=165.227.87.17
MEMBERPRESS_DB_PORT=3306
MEMBERPRESS_DB_NAME=dynastyn_Dynastynerds
MEMBERPRESS_DB_USER=nick_readonly
MEMBERPRESS_DB_PASSWORD=kyxWpSxAjqeGcwuHv7r1
```

### 3. Update AI Categorization
Modify `src/services/aiService.ts`:

```typescript
// Add to categorization logic
const MEMBERPRESS_PATTERNS = {
  ACCESS_ISSUES: [
    /can'?t\s+access/i,
    /no\s+premium/i,
    /asking\s+to\s+pay/i,
    /upgrade\s+required/i,
    /lost\s+access/i
  ],
  BILLING_QUERIES: [
    /how\s+much.*pay/i,
    /billing\s+history/i,
    /grandfathered/i,
    /charge/i,
    /transaction/i
  ],
  CANCELLATION: [
    /cancel.*subscription/i,
    /want.*refund/i,
    /stop.*billing/i,
    /unsubscribe/i
  ]
};

// In categorizeMessage function
if (MEMBERPRESS_PATTERNS.ACCESS_ISSUES.some(pattern => pattern.test(message))) {
  categories.push('memberpress_access');
}
if (MEMBERPRESS_PATTERNS.BILLING_QUERIES.some(pattern => pattern.test(message))) {
  categories.push('memberpress_billing');
}
if (MEMBERPRESS_PATTERNS.CANCELLATION.some(pattern => pattern.test(message))) {
  categories.push('memberpress_cancellation');
}
```

### 4. Update Conversation Handler
Modify `src/api/conversations.ts`:

```typescript
import { memberPressService } from '../services/memberPressService';

// In the conversation handler, get customer email from Help Scout
const customerEmail = conversation.customer.email;

if (categories.includes('memberpress_access') || 
    categories.includes('memberpress_billing') ||
    categories.includes('memberpress_cancellation')) {
  
  const memberPressData = await getMemberPressContext(customerEmail);
  
  // Add to AI context
  context += `\n\nMemberPress Subscription Data:\n${JSON.stringify(memberPressData, null, 2)}`;
  context += `\nLookup performed using Help Scout email: ${customerEmail}`;
}

async function getMemberPressContext(email: string) {
  try {
    // First check if user exists in MemberPress
    const userId = await memberPressService.getUserIdByEmail(email);
    
    if (!userId) {
      return {
        userFound: false,
        lookupEmail: email,
        message: 'No user found with this email in MemberPress database'
      };
    }
    
    const activeStatus = await memberPressService.hasActiveTransaction(email);
    const recentTransactions = await memberPressService.getTransactionHistory(email, 5);
    
    // Check if user exists but has no transactions
    if (recentTransactions.length === 0) {
      return {
        userFound: true,
        hasTransactions: false,
        lookupEmail: email,
        message: 'User exists but has no transaction history'
      };
    }
    
    return {
      userFound: true,
      hasTransactions: true,
      lookupEmail: email,
      hasActiveSubscription: activeStatus.isActive,
      activeSubscription: activeStatus.subscription,
      expiresAt: activeStatus.expiresAt,
      recentTransactions: recentTransactions.map(t => ({
        date: t.created_at,
        amount: t.total,
        status: t.status,
        gateway: t.gateway
      }))
    };
  } catch (error) {
    logger.error('Error fetching MemberPress data:', error);
    return { error: 'Unable to fetch subscription data' };
  }
}
```

### 5. Update AI Prompt
Modify the system prompt to include MemberPress context:

```typescript
const MEMBERPRESS_PROMPT = `
When users ask about subscription access, billing, or cancellations:

1. If MemberPress data is provided, use it to give specific information
2. Always say "I've checked your account" when referencing their subscription
3. Handle different scenarios based on the lookup results:
   - userFound: false → Suggest they may have used a different email
   - hasTransactions: false → User exists but never subscribed
   - hasActiveSubscription: true → Provide subscription details
   - hasActiveSubscription: false → Check last transaction date
4. For cancellations with 'manual' gateway, direct to App Store (iOS/Android)
5. For web cancellations, offer to process it directly
6. Be specific with dates and amounts when available

Response templates:
- Active: "I've checked your account and confirmed you have an active [type] subscription that expires on [date]."
- Inactive: "I've checked your account and don't see an active subscription. Your last subscription expired on [date]."
- No user found: "I couldn't find any subscription history for [email]. This could mean you either haven't signed up yet, or you may have used a different email address when subscribing. Could you check if you might have used another email?"
- User exists, no transactions: "I found your account but don't see any subscription history. If you believe you should have access, you may have subscribed using a different email address."
- App cancellation: "Since you subscribed through the app, you'll need to cancel through the App Store. Here's how: [link]"
`;
```

### 6. Add Response Actions
For cancellations and refunds, add action handlers:

```typescript
// In response processing
if (suggestedResponse.includes('cancel') && memberPressData.activeSubscription) {
  if (memberPressData.activeSubscription.gateway === 'manual') {
    // Add App Store cancellation instructions
    suggestedResponse += '\n\nFor iOS: Settings > [Your Name] > Subscriptions\nFor Android: Play Store > Menu > Subscriptions';
  } else {
    // TODO: Implement actual cancellation API call
    suggestedResponse += '\n\n[Support agent: Use MemberPress admin to cancel subscription ID: ' + 
                        memberPressData.activeSubscription.id + ']';
  }
}
```

### 7. Error Handling
Add comprehensive error handling:

```typescript
// Wrap all MemberPress calls
try {
  const memberPressData = await getMemberPressContext(email);
} catch (error) {
  logger.error('MemberPress integration error:', error);
  // Continue without MemberPress data
  context += '\n\n[MemberPress data unavailable]';
}
```

### 8. Testing Checklist
- [ ] Test with valid user email that has active subscription
- [ ] Test with expired subscription
- [ ] Test with no subscription history
- [ ] Test with manual gateway (app) subscription
- [ ] Test with web gateway subscription
- [ ] Test connection failure handling
- [ ] Test with invalid email

## Deployment Steps
1. Add environment variables to production
2. Install mysql2 package: `npm install mysql2`
3. Deploy service updates
4. Monitor logs for database connection issues
5. Test in production with known test accounts

## Monitoring Points
- Database connection pool status
- Query response times
- Error rates for lookups
- Successful vs failed categorizations