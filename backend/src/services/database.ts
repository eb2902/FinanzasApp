import dotenv from 'dotenv';
import { Pool } from 'pg';

import logger from './logger';

dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://admin:secure_password_123@localhost:5432/fintech_app',
});

/**
 * Initialize database tables if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        kyc_status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create accounts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        currency VARCHAR(3) NOT NULL,
        balance NUMERIC(19, 4) DEFAULT 0.0000,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        amount NUMERIC(19, 4) NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        reference_id VARCHAR(255) UNIQUE,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_accounts_currency ON accounts(currency);
      CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    `);

    // Create trigger function to prevent negative balances
    await client.query(`
      CREATE OR REPLACE FUNCTION check_balance_before_insert()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.amount < 0 THEN
          RAISE EXCEPTION 'Transaction amount cannot be negative';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for transactions
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_check_balance ON transactions;
      CREATE TRIGGER trigger_check_balance
        BEFORE INSERT ON transactions
        FOR EACH ROW
        EXECUTE FUNCTION check_balance_before_insert();
    `);

    // Create function for atomic transfers
    await client.query(`
      CREATE OR REPLACE FUNCTION transfer_between_accounts(
        from_account_id UUID,
        to_account_id UUID,
        transfer_amount NUMERIC(19, 4),
        transfer_reference VARCHAR(255)
      )
      RETURNS BOOLEAN AS $$
      DECLARE
        from_balance NUMERIC(19, 4);
        from_version INTEGER;
      BEGIN
        -- Get current balance and version with row lock
        SELECT balance, version INTO from_balance, from_version
        FROM accounts 
        WHERE id = from_account_id 
        FOR UPDATE;
        
        -- Check if sufficient balance
        IF from_balance < transfer_amount THEN
          RETURN FALSE;
        END IF;
        
        -- Update sender account (optimistic locking)
        UPDATE accounts 
        SET balance = balance - transfer_amount,
            version = version + 1
        WHERE id = from_account_id AND version = from_version;
        
        -- Check if update was successful
        IF NOT FOUND THEN
          RETURN FALSE;
        END IF;
        
        -- Update receiver account
        UPDATE accounts 
        SET balance = balance + transfer_amount
        WHERE id = to_account_id;
        
        -- Create transaction records
        INSERT INTO transactions (account_id, type, amount, status, reference_id, metadata)
        VALUES (from_account_id, 'TRANSFER', transfer_amount * -1, 'COMPLETED', transfer_reference, 
                jsonb_build_object('transfer_type', 'outgoing', 'counterparty_account', to_account_id));
                
        INSERT INTO transactions (account_id, type, amount, status, reference_id, metadata)
        VALUES (to_account_id, 'TRANSFER', transfer_amount, 'COMPLETED', transfer_reference, 
                jsonb_build_object('transfer_type', 'incoming', 'counterparty_account', from_account_id));
        
        RETURN TRUE;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query('COMMIT');
    logger.info('Database initialization completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(error, 'Database initialization failed');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    logger.error(error, 'Database connection failed');
    return false;
  }
}

/**
 * Get database pool instance
 */
export function getPool(): Pool {
  return pool;
}

export default {
  initializeDatabase,
  testConnection,
  getPool,
};
