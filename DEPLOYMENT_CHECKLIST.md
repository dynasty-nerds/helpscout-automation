# MemberPress Integration Deployment Checklist

## Pre-Deployment Checklist

### Environment Variables
- [ ] Add to Vercel environment variables:
  ```
  MEMBERPRESS_DB_HOST=165.227.87.17
  MEMBERPRESS_DB_PORT=3306
  MEMBERPRESS_DB_NAME=dynastyn_Dynastynerds
  MEMBERPRESS_DB_USER=nick_readonly
  MEMBERPRESS_DB_PASSWORD=[actual_password]
  ```

### Code Changes Summary
1. **New Files:**
   - `src/services/memberPressService.ts` - Database service
   - `scripts/test-*.ts` - Testing scripts
   - Documentation files

2. **Modified Files:**
   - `lib/claude-client.ts` - Added MemberPress categorization and error handling
   - `pages/api/scan-and-tag.ts` - Added MemberPress data lookup
   - `package.json` - Added test scripts
   - `.env.example` - Added MemberPress variables

### Features Added
- ✅ Automatic user lookup by Help Scout email
- ✅ Active subscription verification
- ✅ Transaction history retrieval
- ✅ Gateway-specific handling (iOS/Android vs Web)
- ✅ Smart error handling for "user not found"
- ✅ Cost tracking and reporting
- ✅ Clean error messages

### Testing Commands
```bash
# Test database connection
npm run debug:memberpress

# Test with verbose output
npm run test:memberpress:verbose

# Test API integration
npm run test:api:memberpress
```

## Deployment Steps

1. **Commit Changes:**
   ```bash
   git add -A
   git commit -m "Add MemberPress integration for subscription verification"
   ```

2. **Push to GitHub:**
   ```bash
   git push origin main
   ```

3. **Add Environment Variables in Vercel:**
   - Go to Vercel Dashboard > Settings > Environment Variables
   - Add all MEMBERPRESS_* variables
   - Redeploy if needed

4. **Test in Production:**
   ```bash
   # Dry run on specific conversation with subscription keywords
   curl "https://your-app.vercel.app/api/scan-and-tag?conversationId=XXX&dryRun=true"
   ```

## What to Test

1. **User Not Found:**
   - Should suggest checking different email

2. **Active Subscription:**
   - Should show subscription type and expiry date
   - Should say "I've checked your account"

3. **Billing History:**
   - Should show transaction amounts and dates

4. **Cancellation Requests:**
   - Manual gateway → Direct to App Store
   - Web gateway → Offer to help directly

5. **Error Handling:**
   - Database connection failures
   - Invalid emails

## Monitoring
- Watch logs for "MemberPress data retrieved"
- Check cost tracking in API responses
- Monitor for database connection errors