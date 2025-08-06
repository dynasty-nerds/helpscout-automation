#!/usr/bin/env node
import mysql from 'mysql2/promise'

// Quick debug script to test raw database queries

async function debugConnection() {
  console.log('🔍 MemberPress Database Debug Tool\n')
  
  // Show environment
  console.log('Environment Variables:')
  console.log(`DB_HOST: ${process.env.MEMBERPRESS_DB_HOST || '165.227.87.17'}`)
  console.log(`DB_PORT: ${process.env.MEMBERPRESS_DB_PORT || '3306'}`)
  console.log(`DB_NAME: ${process.env.MEMBERPRESS_DB_NAME || 'dynastyn_Dynastynerds'}`)
  console.log(`DB_USER: ${process.env.MEMBERPRESS_DB_USER || 'nick_readonly'}`)
  console.log(`DB_PASS: ${process.env.MEMBERPRESS_DB_PASSWORD ? '***set***' : 'NOT SET!'}\n`)
  
  try {
    // Create direct connection
    const connection = await mysql.createConnection({
      host: process.env.MEMBERPRESS_DB_HOST || '165.227.87.17',
      port: parseInt(process.env.MEMBERPRESS_DB_PORT || '3306'),
      database: process.env.MEMBERPRESS_DB_NAME || 'dynastyn_Dynastynerds',
      user: process.env.MEMBERPRESS_DB_USER || 'nick_readonly',
      password: process.env.MEMBERPRESS_DB_PASSWORD || 'kyxWpSxAjqeGcwuHv7r1'
    })
    
    console.log('✅ Connected to database!\n')
    
    // Test queries
    console.log('Running test queries...\n')
    
    // 1. Check tables exist
    console.log('1. Checking tables:')
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'sri_%'"
    )
    console.log(`Found ${tables.length} tables starting with 'sri_'`)
    
    // 2. Count users
    const [userCount] = await connection.execute(
      "SELECT COUNT(*) as count FROM sri_users"
    )
    console.log(`Total users: ${userCount[0].count}`)
    
    // 3. Count transactions
    const [transCount] = await connection.execute(
      "SELECT COUNT(*) as count FROM sri_mepr_transactions WHERE status = 'complete'"
    )
    console.log(`Complete transactions: ${transCount[0].count}`)
    
    // 4. Sample transaction
    console.log('\n2. Sample transaction data:')
    const [sampleTrans] = await connection.execute(
      "SELECT id, user_id, total, status, gateway, created_at FROM sri_mepr_transactions WHERE status = 'complete' LIMIT 1"
    )
    if (sampleTrans.length > 0) {
      console.log(sampleTrans[0])
    }
    
    // 5. Check gateways
    console.log('\n3. Gateway distribution:')
    const [gateways] = await connection.execute(
      "SELECT gateway, COUNT(*) as count FROM sri_mepr_transactions WHERE status = 'complete' GROUP BY gateway ORDER BY count DESC LIMIT 10"
    )
    gateways.forEach((g: any) => {
      console.log(`${g.gateway || 'NULL'}: ${g.count} transactions`)
    })
    
    // 6. Recent transactions
    console.log('\n4. Recent transactions (last 5):')
    const [recent] = await connection.execute(
      "SELECT t.created_at, t.total, t.gateway, u.user_email FROM sri_mepr_transactions t JOIN sri_users u ON t.user_id = u.ID WHERE t.status = 'complete' ORDER BY t.created_at DESC LIMIT 5"
    )
    recent.forEach((r: any) => {
      console.log(`${r.created_at} - ${r.user_email} - $${r.total} - ${r.gateway}`)
    })
    
    await connection.end()
    console.log('\n✅ Debug complete!')
    
  } catch (error: any) {
    console.error('❌ Database error:', error.message)
    console.error('\nFull error:', error)
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n🔐 Access denied - check your password')
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n🌐 Connection refused - check host/port and network access')
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n📁 Database not found - check database name')
    }
  }
}

// Run debug
debugConnection()