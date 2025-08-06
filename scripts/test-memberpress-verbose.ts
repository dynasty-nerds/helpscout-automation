#!/usr/bin/env node
import { memberPressService } from '../src/services/memberPressService'
import axios from 'axios'

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60))
  log(title, colors.bright + colors.blue)
  console.log('='.repeat(60))
}

function logSubSection(title: string) {
  console.log('\n' + '-'.repeat(40))
  log(title, colors.cyan)
  console.log('-'.repeat(40))
}

async function testDatabaseConnection() {
  logSection('1. TESTING DATABASE CONNECTION')
  
  try {
    log('Attempting to connect to MemberPress database...', colors.yellow)
    log(`Host: ${process.env.MEMBERPRESS_DB_HOST || '165.227.87.17'}`)
    log(`Port: ${process.env.MEMBERPRESS_DB_PORT || '3306'}`)
    log(`Database: ${process.env.MEMBERPRESS_DB_NAME || 'dynastyn_Dynastynerds'}`)
    log(`User: ${process.env.MEMBERPRESS_DB_USER || 'nick_readonly'}`)
    log(`Password: ${process.env.MEMBERPRESS_DB_PASSWORD ? '***hidden***' : 'Using default'}`)
    
    // Test a simple query
    const testEmail = 'test@example.com'
    const userId = await memberPressService.getUserIdByEmail(testEmail)
    log(`✅ Database connection successful!`, colors.green)
    log(`Test query result - User ID for ${testEmail}: ${userId || 'Not found'}`)
  } catch (error: any) {
    log(`❌ Database connection failed!`, colors.red)
    log(`Error: ${error.message}`, colors.red)
    throw error
  }
}

async function testUserLookup(email: string) {
  logSubSection(`Testing User Lookup: ${email}`)
  
  try {
    log(`Looking up user by email: ${email}`, colors.yellow)
    const userId = await memberPressService.getUserIdByEmail(email)
    
    if (userId) {
      log(`✅ User found! ID: ${userId}`, colors.green)
      return userId
    } else {
      log(`⚠️  No user found with email: ${email}`, colors.yellow)
      return null
    }
  } catch (error: any) {
    log(`❌ Error during user lookup: ${error.message}`, colors.red)
    return null
  }
}

async function testActiveTransaction(email: string) {
  logSubSection(`Testing Active Transaction: ${email}`)
  
  try {
    log(`Checking for active transactions...`, colors.yellow)
    const result = await memberPressService.hasActiveTransaction(email)
    
    log(`Active subscription: ${result.isActive ? 'YES' : 'NO'}`)
    
    if (result.isActive && result.subscription) {
      log(`✅ Active Subscription Details:`, colors.green)
      log(`  - Type: ${result.subscription.type}`)
      log(`  - Gateway: ${result.subscription.gateway}`)
      log(`  - Amount: $${result.subscription.amount}`)
      log(`  - Product ID: ${result.subscription.productId}`)
      log(`  - Expires: ${result.expiresAt}`)
      
      // Check gateway type
      if (result.subscription.gateway === 'manual') {
        log(`  ⚠️  This is an App Store subscription (iOS/Android)`, colors.yellow)
      } else {
        log(`  ℹ️  This is a web subscription (can be cancelled directly)`, colors.cyan)
      }
    } else {
      log(`ℹ️  No active subscription found`, colors.yellow)
    }
    
    return result
  } catch (error: any) {
    log(`❌ Error checking active transaction: ${error.message}`, colors.red)
    return { isActive: false }
  }
}

async function testTransactionHistory(email: string) {
  logSubSection(`Testing Transaction History: ${email}`)
  
  try {
    log(`Retrieving transaction history...`, colors.yellow)
    const transactions = await memberPressService.getTransactionHistory(email, 10)
    
    if (transactions.length > 0) {
      log(`✅ Found ${transactions.length} transactions:`, colors.green)
      transactions.forEach((t, index) => {
        log(`\n  Transaction ${index + 1}:`)
        log(`    - Date: ${t.created_at}`)
        log(`    - Amount: $${t.total}`)
        log(`    - Status: ${t.status}`)
        log(`    - Gateway: ${t.gateway}`)
        log(`    - Transaction ID: ${t.id}`)
      })
    } else {
      log(`ℹ️  No transaction history found`, colors.yellow)
    }
    
    return transactions
  } catch (error: any) {
    log(`❌ Error retrieving transaction history: ${error.message}`, colors.red)
    return []
  }
}

async function testFullContext(email: string) {
  logSubSection(`Testing Full MemberPress Context: ${email}`)
  
  try {
    log(`Generating full context...`, colors.yellow)
    const context = await memberPressService.getMemberPressContext(email)
    
    log(`\n📊 Full Context Response:`, colors.magenta)
    console.log(JSON.stringify(context, null, 2))
    
    // Analyze the response
    if (!context.userFound) {
      log(`\n🔍 Analysis: User not found - would suggest checking other email`, colors.yellow)
    } else if (!context.hasTransactions) {
      log(`\n🔍 Analysis: User exists but no transactions - never subscribed`, colors.yellow)
    } else if (context.hasActiveSubscription) {
      log(`\n🔍 Analysis: Active subscription found - provide access details`, colors.green)
    } else {
      log(`\n🔍 Analysis: Expired subscription - last transaction on ${context.recentTransactions?.[0]?.date}`, colors.yellow)
    }
    
    return context
  } catch (error: any) {
    log(`❌ Error generating context: ${error.message}`, colors.red)
    return null
  }
}

async function testAIIntegration(email: string, message: string) {
  logSection('5. TESTING AI INTEGRATION')
  
  log(`Simulating customer message: "${message}"`, colors.yellow)
  log(`Customer email: ${email}`)
  
  // Check if message would trigger MemberPress lookup
  const lowerMessage = message.toLowerCase()
  const triggers = ['access', 'premium', 'subscription', 'billing', 'cancel', 'refund', 'grandfathered', 'pay', 'upgrade']
  const wouldTrigger = triggers.some(trigger => lowerMessage.includes(trigger))
  
  log(`\nWould trigger MemberPress lookup: ${wouldTrigger ? 'YES' : 'NO'}`)
  if (wouldTrigger) {
    log(`Detected keywords: ${triggers.filter(t => lowerMessage.includes(t)).join(', ')}`, colors.green)
  }
  
  // Test categorization
  logSubSection('AI Categorization Test')
  
  const testCases = [
    { message: "I can't access the premium features", expected: "MemberPress Access Issue" },
    { message: "How much am I paying?", expected: "MemberPress Billing Query" },
    { message: "I want to cancel my subscription", expected: "MemberPress Cancellation" },
    { message: "The app is asking me to upgrade but I already paid", expected: "MemberPress Access Issue" }
  ]
  
  testCases.forEach(test => {
    log(`\nMessage: "${test.message}"`)
    log(`Expected category: ${test.expected}`, colors.cyan)
  })
}

async function simulateAPICall() {
  logSection('6. SIMULATING API ENDPOINT CALL')
  
  log('This would be called by the scan-and-tag endpoint when processing a conversation', colors.yellow)
  log('\nAPI Flow:', colors.cyan)
  log('1. Customer message detected with MemberPress keywords')
  log('2. API extracts customer email from Help Scout conversation')
  log('3. API calls memberPressService.getMemberPressContext(email)')
  log('4. Context added to conversation history for Claude')
  log('5. Claude generates response using the MemberPress data')
  
  log('\nExample conversation history that would be sent to Claude:', colors.magenta)
  const exampleContext = `
Subject: Can't access premium features

Customer: I paid for a subscription but I can't access any of the premium features. The app keeps asking me to upgrade.

MemberPress Subscription Data:
User Email: customer@example.com
{
  "userFound": true,
  "hasTransactions": true,
  "lookupEmail": "customer@example.com",
  "hasActiveSubscription": true,
  "activeSubscription": {
    "id": 12345,
    "type": "Bundle Monthly",
    "gateway": "pr2jtc-3b5",
    "amount": 6.99,
    "productId": 40183
  },
  "expiresAt": "2025-09-15T00:00:00.000Z",
  "recentTransactions": [
    {
      "date": "2025-08-15T00:00:00.000Z",
      "amount": 6.99,
      "status": "complete",
      "gateway": "pr2jtc-3b5"
    }
  ]
}`
  
  console.log(exampleContext)
}

async function runAllTests() {
  log('\n🚀 MEMBERPRESS INTEGRATION VERBOSE TEST SUITE', colors.bright + colors.magenta)
  log('Testing every component with detailed logging\n')
  
  try {
    // Test 1: Database Connection
    await testDatabaseConnection()
    
    // Test 2: Test with multiple emails
    logSection('2. TESTING USER LOOKUPS')
    const testEmails = [
      'test@example.com',          // Likely doesn't exist - tests "user not found" scenario
      'psiloship@gmail.com',       // Real member - tests actual subscription data
    ]
    
    for (const email of testEmails) {
      await testUserLookup(email)
    }
    
    // Test 3: Active Transactions
    logSection('3. TESTING ACTIVE TRANSACTIONS')
    for (const email of testEmails) {
      await testActiveTransaction(email)
    }
    
    // Test 4: Transaction History
    logSection('4. TESTING TRANSACTION HISTORY')
    for (const email of testEmails) {
      await testTransactionHistory(email)
      
      // Full context test
      await testFullContext(email)
    }
    
    // Test 5: AI Integration
    await testAIIntegration(
      'customer@example.com',
      "I can't access the app even though I have a subscription"
    )
    
    // Test 6: API Simulation
    await simulateAPICall()
    
    // Close connection
    await memberPressService.close()
    
    logSection('✅ ALL TESTS COMPLETED!')
    log('\nNext steps:', colors.cyan)
    log('1. Add a real customer email to testEmails array')
    log('2. Check that MemberPress keywords trigger lookups')
    log('3. Verify the AI response includes "I\'ve checked your account"')
    log('4. Test with actual Help Scout conversation via API')
    
  } catch (error: any) {
    log(`\n❌ TEST SUITE FAILED: ${error.message}`, colors.red)
    console.error(error)
    process.exit(1)
  }
}

// Run the tests
runAllTests()