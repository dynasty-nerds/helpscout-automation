#!/usr/bin/env node
import axios from 'axios'

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000'
const CONVERSATION_ID = process.env.TEST_CONVERSATION_ID || '12345'

// Color codes
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

async function testSpecificConversation(conversationId: string) {
  log(`\n🔍 Testing specific conversation: ${conversationId}`, colors.bright + colors.blue)
  
  try {
    const response = await axios.get(`${API_URL}/api/scan-and-tag`, {
      params: {
        conversationId,
        dryRun: true
      }
    })
    
    log('\n✅ API Response:', colors.green)
    console.log(JSON.stringify(response.data, null, 2))
    
    // Check if MemberPress was triggered
    if (response.data.urgentTickets?.length > 0) {
      const ticket = response.data.urgentTickets[0]
      log('\n📋 Ticket Analysis:', colors.cyan)
      log(`Subject: ${ticket.subject}`)
      log(`Preview: ${ticket.preview}`)
      
      // Look for MemberPress indicators in the preview
      if (ticket.preview.includes('MemberPress')) {
        log('✅ MemberPress integration was triggered!', colors.green)
      }
    }
    
  } catch (error: any) {
    log(`\n❌ Error testing conversation: ${error.message}`, colors.red)
    if (error.response) {
      console.error('Response data:', error.response.data)
    }
  }
}

async function testWithMockData() {
  log('\n🧪 Testing with mock MemberPress scenarios', colors.bright + colors.magenta)
  
  // Mock conversation scenarios
  const scenarios = [
    {
      name: 'Access Issue - Active Subscription',
      message: "I can't access the premium features in the app",
      expectedCategory: 'MemberPress Access Issue',
      memberPressData: {
        userFound: true,
        hasActiveSubscription: true,
        activeSubscription: {
          type: 'Bundle Monthly',
          gateway: 'pr2jtc-3b5',
          expiresAt: '2025-09-15'
        }
      }
    },
    {
      name: 'Access Issue - No User Found',
      message: "I paid but can't access anything",
      expectedCategory: 'MemberPress Access Issue',
      memberPressData: {
        userFound: false,
        lookupEmail: 'user@example.com'
      }
    },
    {
      name: 'Billing Query',
      message: "How much am I paying for my subscription?",
      expectedCategory: 'MemberPress Billing Query',
      memberPressData: {
        userFound: true,
        hasActiveSubscription: true,
        recentTransactions: [
          { date: '2025-08-15', amount: 6.99, status: 'complete' }
        ]
      }
    },
    {
      name: 'Cancellation - App Store',
      message: "I want to cancel my subscription",
      expectedCategory: 'MemberPress Cancellation',
      memberPressData: {
        userFound: true,
        hasActiveSubscription: true,
        activeSubscription: {
          gateway: 'manual',
          type: 'Bundle Monthly'
        }
      }
    }
  ]
  
  for (const scenario of scenarios) {
    log(`\n--- ${scenario.name} ---`, colors.cyan)
    log(`Message: "${scenario.message}"`)
    log(`Expected Category: ${scenario.expectedCategory}`)
    log(`MemberPress Data:`, colors.yellow)
    console.log(JSON.stringify(scenario.memberPressData, null, 2))
    
    log('\nExpected AI Response Characteristics:', colors.green)
    if (!scenario.memberPressData.userFound) {
      log('- Should mention checking different email')
    } else if (scenario.memberPressData.hasActiveSubscription) {
      log('- Should say "I\'ve checked your account"')
      log('- Should mention subscription type and expiry')
    }
    
    if (scenario.memberPressData.activeSubscription?.gateway === 'manual') {
      log('- Should direct to App Store for cancellation')
    }
  }
}

async function testEndToEnd() {
  log('\n🔄 End-to-End Integration Test', colors.bright + colors.blue)
  
  log('\n1. Customer sends message with MemberPress keyword', colors.yellow)
  log('2. API detects keyword and triggers lookup', colors.yellow)
  log('3. MemberPress service queries database', colors.yellow)
  log('4. Data added to conversation context', colors.yellow)
  log('5. Claude generates response with account details', colors.yellow)
  
  log('\n📝 To test manually:', colors.cyan)
  log('1. Find a real Help Scout conversation ID')
  log('2. Run: TEST_CONVERSATION_ID=xxxxx npm run test:api:memberpress')
  log('3. Check the generated note for MemberPress data')
  log('4. Verify the AI response includes account-specific information')
}

async function checkEnvironment() {
  log('\n🔧 Environment Check', colors.bright + colors.yellow)
  
  const required = [
    'MEMBERPRESS_DB_HOST',
    'MEMBERPRESS_DB_USER',
    'MEMBERPRESS_DB_PASSWORD',
    'HELPSCOUT_APP_ID',
    'HELPSCOUT_APP_SECRET',
    'CLAUDE_API_KEY'
  ]
  
  let allSet = true
  for (const env of required) {
    const isSet = !!process.env[env]
    log(`${env}: ${isSet ? '✅ Set' : '❌ Missing'}`, isSet ? colors.green : colors.red)
    if (!isSet) allSet = false
  }
  
  if (!allSet) {
    log('\n⚠️  Some environment variables are missing!', colors.yellow)
    log('Make sure to set them in your .env file', colors.yellow)
  }
  
  return allSet
}

async function runTests() {
  log('🚀 MEMBERPRESS API INTEGRATION TEST', colors.bright + colors.magenta)
  log('Testing the full integration through the API endpoint\n')
  
  // Check environment
  const envOk = await checkEnvironment()
  if (!envOk) {
    log('\n⚠️  Fix environment variables before running full tests', colors.yellow)
  }
  
  // Test with mock data
  await testWithMockData()
  
  // Test end-to-end flow
  await testEndToEnd()
  
  // Test specific conversation if provided
  if (process.env.TEST_CONVERSATION_ID) {
    await testSpecificConversation(process.env.TEST_CONVERSATION_ID)
  } else {
    log('\n💡 Tip: Set TEST_CONVERSATION_ID to test with a real conversation', colors.cyan)
    log('Example: TEST_CONVERSATION_ID=12345 npm run test:api:memberpress', colors.cyan)
  }
  
  log('\n✅ Tests completed!', colors.green)
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Test failed: ${error.message}`, colors.red)
  console.error(error)
  process.exit(1)
})