# MemberPress Integration Documentation

## Overview
This integration allows the Help Scout AI assistant to automatically verify subscription status, transaction history, and handle cancellation/refund requests by querying the MemberPress database.

## Features
- **Automatic subscription verification** when customers mention access issues
- **Transaction history lookup** for billing inquiries
- **Gateway-aware cancellation handling** (iOS/Android vs Web)
- **Smart email fallback suggestions** when no user is found

## Use Cases

### 1. Access Issues
When customers say:
- "I can't access the app"
- "Premium features are locked"
- "It's asking me to pay but I already subscribed"

The AI will:
1. Look up their subscription using their Help Scout email
2. Check if they have an active transaction
3. Respond with specific subscription status and expiration date

### 2. Billing Queries
When customers ask:
- "How much am I paying?"
- "What's my billing history?"
- "I should have a grandfathered rate"

The AI will:
1. Retrieve their transaction history
2. Show amounts and dates
3. Confirm their current rate

### 3. Cancellations
When customers request:
- "Cancel my subscription"
- "I want a refund"
- "Stop billing me"

The AI will:
1. Check their gateway type
2. For 'manual' gateway (iOS/Android): Direct to App Store
3. For web gateways: Offer to process cancellation directly

## Configuration

### Environment Variables
Add these to your `.env` file:
```
MEMBERPRESS_DB_HOST=165.227.87.17
MEMBERPRESS_DB_PORT=3306
MEMBERPRESS_DB_NAME=dynastyn_Dynastynerds
MEMBERPRESS_DB_USER=nick_readonly
MEMBERPRESS_DB_PASSWORD=your_actual_password
```

### Testing the Integration
Run the test script to verify connectivity:
```bash
npm run test:memberpress
```

## How It Works

### 1. Keyword Detection
The system monitors customer messages for keywords like:
- access, premium, subscription
- billing, charge, grandfathered
- cancel, refund, unsubscribe

### 2. Database Lookup
When keywords are detected:
1. Uses the customer's Help Scout email
2. Queries `sri_users` table for user ID
3. Checks `sri_mepr_transactions` for active subscriptions
4. Retrieves transaction history

### 3. Active Transaction Logic
A transaction is considered active if:
- Status = 'complete'
- Monthly: created_at + 30 days > NOW()
- Yearly: created_at + 365 days > NOW()

### 4. AI Response Generation
The AI receives the MemberPress data and:
- Always says "I've checked your account"
- Provides specific dates and amounts
- Handles "user not found" gracefully
- Routes cancellations based on gateway type

## Database Schema

### Key Tables
- **sri_users**: Contains user emails and IDs
- **sri_mepr_transactions**: Payment history
- **sri_mepr_subscriptions**: Subscription details
- **sri_posts**: Product names

### Important Fields
- `gateway`: Determines cancellation flow
  - 'manual' = iOS/Android App Store
  - 'pr2jtc-3b5', 'rnvjyq-n2' = Stripe (Web)
- `product_id`: Maps to subscription type
  - 39823, 40183 = Bundle
  - 40184, 40185 = GM Only
  - 18491, 18492 = NerdHerd Only

## Response Examples

### Active Subscription
> "Hey [Name],
> 
> I've checked your account and confirmed you have an active Bundle Monthly subscription that expires on March 15th, 2025. You should have full access to all premium features."

### No User Found
> "Hey [Name],
> 
> I couldn't find any subscription history for your@email.com. This could mean you either haven't signed up yet, or you may have used a different email address when subscribing. Could you check if you might have used another email?"

### App Store Cancellation
> "Hey [Name],
> 
> I've checked your account and see you have an active subscription through the app. Since you subscribed through the app, you'll need to cancel through the App Store:
> 
> For iOS: Settings > [Your Name] > Subscriptions
> For Android: Play Store > Menu > Subscriptions"

## Troubleshooting

### Common Issues
1. **Database connection fails**: Check credentials and network access
2. **User not found**: Customer may have used different email
3. **No transactions**: User exists but never purchased

### Debug Mode
Enable detailed logging in the API:
```javascript
console.log('MemberPress data retrieved:', JSON.stringify(memberPressContext, null, 2))
```

## Security Considerations
- Uses read-only database access
- Never exposes credentials in responses
- Logs all lookup attempts
- No direct modification capabilities (cancellations are manual)

## Future Enhancements
- [ ] Automatic cancellation processing
- [ ] Refund amount calculation
- [ ] Subscription upgrade/downgrade detection
- [ ] Coupon code validation