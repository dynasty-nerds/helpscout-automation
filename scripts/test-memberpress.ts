#!/usr/bin/env node
import { memberPressService } from '../src/services/memberPressService'

async function testMemberPress() {
  console.log('Testing MemberPress integration...\n')
  
  // Test email addresses
  const testEmails = [
    'test@example.com', // Likely won't exist
    // Add real test emails here if you have them
  ]
  
  for (const email of testEmails) {
    console.log(`\n=== Testing email: ${email} ===`)
    
    try {
      // Test user lookup
      const userId = await memberPressService.getUserIdByEmail(email)
      console.log(`User ID: ${userId || 'Not found'}`)
      
      // Test active transaction check
      const activeStatus = await memberPressService.hasActiveTransaction(email)
      console.log(`Has active transaction: ${activeStatus.isActive}`)
      
      if (activeStatus.isActive) {
        console.log(`Subscription type: ${activeStatus.subscription?.type}`)
        console.log(`Gateway: ${activeStatus.subscription?.gateway}`)
        console.log(`Expires at: ${activeStatus.expiresAt}`)
      }
      
      // Test transaction history
      const transactions = await memberPressService.getTransactionHistory(email, 5)
      console.log(`Transaction count: ${transactions.length}`)
      
      if (transactions.length > 0) {
        console.log('\nRecent transactions:')
        transactions.forEach((t, i) => {
          console.log(`  ${i + 1}. Date: ${t.created_at}, Amount: $${t.total}, Status: ${t.status}`)
        })
      }
      
      // Test full context
      console.log('\n--- Full MemberPress Context ---')
      const context = await memberPressService.getMemberPressContext(email)
      console.log(JSON.stringify(context, null, 2))
      
    } catch (error) {
      console.error(`Error testing ${email}:`, error)
    }
  }
  
  // Close connection
  await memberPressService.close()
  console.log('\n✅ Test complete!')
}

// Run the test
testMemberPress().catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})