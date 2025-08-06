import mysql from 'mysql2/promise';

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

interface ActiveSubscriptionResult {
  isActive: boolean;
  subscription?: {
    id: number;
    type: string;
    gateway: string;
    amount: number;
    productId: number;
  };
  expiresAt?: Date;
}

interface MemberPressContext {
  userFound: boolean;
  hasTransactions?: boolean;
  lookupEmail: string;
  hasActiveSubscription?: boolean;
  activeSubscription?: any;
  expiresAt?: Date;
  recentTransactions?: Array<{
    date: Date;
    amount: number;
    status: string;
    gateway: string;
  }>;
  message?: string;
  error?: string;
}

class MemberPressService {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.MEMBERPRESS_DB_HOST || '165.227.87.17',
      port: parseInt(process.env.MEMBERPRESS_DB_PORT || '3306'),
      database: process.env.MEMBERPRESS_DB_NAME || 'dynastyn_Dynastynerds',
      user: process.env.MEMBERPRESS_DB_USER || 'nick_readonly',
      password: process.env.MEMBERPRESS_DB_PASSWORD || 'kyxWpSxAjqeGcwuHv7r1',
      connectionLimit: 5, // Reduced from 10 to prevent connection exhaustion
      waitForConnections: true,
      queueLimit: 10, // Added queue limit to prevent infinite waiting
      acquireTimeout: 10000, // 10 second timeout for acquiring connection
      connectTimeout: 10000 // 10 second connection timeout
    });
  }

  async getUserIdByEmail(email: string): Promise<number | null> {
    try {
      const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
        'SELECT ID FROM sri_users WHERE user_email = ?',
        [email.toLowerCase()]
      );
      return rows[0]?.ID || null;
    } catch (error: any) {
      console.error('Error getting user ID by email:', error);
      // Handle connection pool errors gracefully
      if (error.code === 'ER_CON_COUNT_ERROR' || error.code === 'ECONNREFUSED') {
        console.error('Database connection pool exhausted or unavailable');
        return null; // Return null instead of throwing to allow graceful degradation
      }
      throw error;
    }
  }

  async hasActiveTransaction(email: string): Promise<ActiveSubscriptionResult> {
    const userId = await this.getUserIdByEmail(email);
    if (!userId) return { isActive: false };

    const query = `
      SELECT 
        t.*,
        s.gateway,
        s.period_type,
        s.period,
        s.product_id,
        s.id as subscription_id,
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

    try {
      const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(query, [userId]);
      
      if (rows.length > 0) {
        const transaction = rows[0];
        return {
          isActive: true,
          subscription: {
            id: transaction.subscription_id,
            type: this.getSubscriptionType(transaction.product_name, transaction.period_type),
            gateway: transaction.gateway,
            amount: parseFloat(transaction.total),
            productId: transaction.product_id
          },
          expiresAt: transaction.expires_at
        };
      }

      return { isActive: false };
    } catch (error) {
      console.error('Error checking active transaction:', error);
      throw error;
    }
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

    try {
      const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(query, [userId, limit]);
      return rows as Transaction[];
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }

  async getMemberPressContext(email: string): Promise<MemberPressContext> {
    try {
      // First check if user exists in MemberPress
      const userId = await this.getUserIdByEmail(email);
      
      if (!userId) {
        return {
          userFound: false,
          lookupEmail: email,
          message: 'No user found with this email in MemberPress database'
        };
      }
      
      const activeStatus = await this.hasActiveTransaction(email);
      const recentTransactions = await this.getTransactionHistory(email, 5);
      
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
          amount: parseFloat(t.total.toString()),
          status: t.status,
          gateway: t.gateway
        }))
      };
    } catch (error: any) {
      console.error('Error fetching MemberPress data:', error);
      
      // Provide more specific error messages for different error types
      let errorMessage = 'Unable to fetch subscription data';
      if (error.code === 'ER_CON_COUNT_ERROR') {
        errorMessage = 'Database connection limit reached. Please try again in a moment.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Database connection unavailable. Please try again later.';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorMessage = 'Database query timed out. Please try again.';
      }
      
      return { 
        userFound: false,
        lookupEmail: email,
        error: errorMessage 
      };
    }
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