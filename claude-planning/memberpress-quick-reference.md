# MemberPress Integration Quick Reference

## Key Use Cases
1. **Access Issues** - "can't access", "no premium", "upgrade required"
2. **Billing History** - "how much paying", "grandfathered rate"  
3. **Cancellations** - "cancel subscription", "want refund"

## Email Lookup Flow
```
Help Scout Customer Email → MemberPress User Lookup → Transaction History
```

## Response Scenarios

### User Not Found
```
No email match in database → "Could you have used a different email?"
```

### User Exists, No Transactions
```
User found but no purchases → "Account exists but no subscription history"
```

### Active Subscription
```
Current date < Expiry date → "Active [type] subscription expires [date]"
```

### Expired Subscription
```
Current date > Expiry date → "Subscription expired on [date]"
```

## Gateway Handling
- **Manual Gateway** = iOS/Android → Direct to App Store
- **Web Gateway** (pr2jtc-3b5, rnvjyq-n2) = Stripe → Can cancel directly

## Active Transaction Logic
```sql
Monthly: created_at + 30 days > NOW()
Yearly: created_at + 365 days > NOW()
```

## Key Database Tables
- `sri_users` - User emails
- `sri_mepr_transactions` - Payment history
- `sri_mepr_subscriptions` - Subscription details
- `sri_posts` - Product names

## Always Remember
- Use Help Scout customer email for lookups
- Say "I've checked your account" in responses
- Provide specific dates and amounts
- Handle "no user found" gracefully