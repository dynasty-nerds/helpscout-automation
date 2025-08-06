# MemberPress Integration Plan for Help Scout

**Type**: Implementation Plan

## Overview
Integrate MemberPress database functionality into the Help Scout AI assistant to automatically verify subscription status, transaction history, and handle cancellation/refund requests based on customer support inquiries.

## User Need
- Customers complain about not having access to the app or premium features
- Users question their billing history or claim they should be grandfathered
- Support team needs to verify active subscriptions without manual database lookups
- Automate cancellation and refund processes based on gateway type

## Key Use Cases

### 1. Access Issues
**Triggers**: "can't access", "no premium", "asking to pay", "upgrade required"
**Action**: Verify active transaction status
**Response**: Confirm active/inactive status with specific details

### 2. Billing History
**Triggers**: "how much paying", "billing history", "grandfathered rate"
**Action**: Retrieve transaction history and amounts
**Response**: Provide transaction summary with amounts and dates

### 3. Cancellation/Refund
**Triggers**: "cancel subscription", "want refund", "stop billing"
**Action**: Check gateway type and process accordingly
**Response**: Process cancellation/refund OR direct to App Store if manual gateway

## Implementation Steps

### 1. Database Integration Architecture
```typescript
// Create MemberPressService class
interface MemberPressService {
  hasActiveTransaction(userEmail: string): Promise<boolean>
  getTransactionHistory(userEmail: string): Promise<Transaction[]>
  getActiveSubscription(userEmail: string): Promise<Subscription | null>
  cancelSubscription(subscriptionId: number): Promise<boolean>
  processRefund(transactionId: number): Promise<boolean>
}
```

### 2. Active Transaction Logic
```sql
-- Check for active transaction
SELECT t.*, s.gateway, s.period_type, s.period
FROM sri_mepr_transactions t
JOIN sri_mepr_subscriptions s ON t.subscription_id = s.id
WHERE t.user_id = (SELECT ID FROM sri_users WHERE user_email = ?)
  AND t.status = 'complete'
  AND (
    (s.period_type = 'months' AND DATE_ADD(t.created_at, INTERVAL 30 DAY) > NOW())
    OR (s.period_type = 'years' AND DATE_ADD(t.created_at, INTERVAL 365 DAY) > NOW())
  )
ORDER BY t.created_at DESC
LIMIT 1
```

### 3. Add to AI Categorization
Update `categorizeAndRespond` to detect MemberPress-related keywords:
```typescript
const memberPressKeywords = [
  'access', 'premium', 'subscription', 'billing', 'charge',
  'cancel', 'refund', 'grandfathered', 'pay', 'upgrade'
];
```

### 4. Gateway-Specific Handling
```typescript
if (subscription.gateway === 'manual') {
  // iOS/Android - direct to App Store
  return {
    canCancelDirectly: false,
    message: "Since you subscribed through the app, you'll need to cancel through the App Store..."
  };
} else {
  // Web subscriptions - can cancel directly
  return {
    canCancelDirectly: true,
    message: "I can help you cancel your subscription..."
  };
}
```

### 5. Response Templates
```typescript
const MEMBERPRESS_RESPONSES = {
  ACTIVE_SUBSCRIPTION: "I've checked your account and confirmed you have an active {type} subscription that expires on {date}.",
  NO_ACTIVE_SUBSCRIPTION: "I've checked your account and don't see an active subscription. Your last subscription expired on {date}.",
  NO_TRANSACTIONS_FOUND: "I couldn't find any subscription history for {email}. This could mean you either haven't signed up yet, or you may have used a different email address when subscribing. Could you check if you might have used another email?",
  TRANSACTION_HISTORY: "Here's your billing history:\n{transactions}",
  CANCELLATION_WEB: "I've successfully cancelled your subscription. You'll continue to have access until {expiry_date}.",
  CANCELLATION_APP: "Since you subscribed through the {store}, you'll need to cancel there. Here's how: {instructions_link}",
  REFUND_PROCESSED: "I've processed a refund for your last payment of ${amount}. It should appear in 3-5 business days.",
};
```

### 6. Integration Points
1. **conversationService.ts**: Add MemberPress context to conversation analysis
2. **aiService.ts**: Include subscription status in AI prompt context
3. **responseService.ts**: Add MemberPress data to response generation
4. **New file**: `memberPressService.ts` for all database operations

## Technical Details

### Database Connection
- Use existing MySQL connection from MemberPress project
- Read-only access for queries
- Write access only for cancellations/refunds

### Data Flow
1. User message → Detect MemberPress keywords
2. Extract user email from conversation
3. Query MemberPress database
4. Include results in AI context
5. Generate appropriate response
6. Execute actions if needed (cancel/refund)

### Security Considerations
- Never expose database credentials in responses
- Log all cancellation/refund actions
- Validate user identity before actions
- Use prepared statements for all queries

## Testing Plan
1. Test active subscription detection with various expiry dates
2. Test transaction history retrieval
3. Test gateway detection (web vs manual)
4. Test cancellation flow for web subscriptions
5. Test App Store redirection for manual gateways
6. Test refund processing
7. Test edge cases (no user found, multiple subscriptions)

## Monitoring
- Track MemberPress query usage
- Monitor successful vs failed lookups
- Log all cancellation/refund actions
- Alert on database connection failures

## Notes
- Active transaction = start_date <= today AND expiry_date > today
- Manual gateway = iOS/Android App Store subscriptions
- Web gateways = 'pr2jtc-3b5', 'rnvjyq-n2' (Stripe)
- Always mention "we've looked at your account" in responses
- Provide specific dates and amounts when available