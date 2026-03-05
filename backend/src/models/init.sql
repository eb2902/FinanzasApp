-- Database Schema Initialization
-- Creates tables: users, accounts, transactions
-- Follows the schema defined in docs/db-schema.md

-- Drop existing objects if they exist (for clean reinitialization)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop enum types if they exist
DROP TYPE IF EXISTS kyc_status_enum CASCADE;
DROP TYPE IF EXISTS transaction_type_enum CASCADE;
DROP TYPE IF EXISTS transaction_status_enum CASCADE;

-- Create enum types
CREATE TYPE kyc_status_enum AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE transaction_type_enum AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT');
CREATE TYPE transaction_status_enum AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    kyc_status kyc_status_enum NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create accounts table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    currency VARCHAR(3) NOT NULL, -- ISO 4217 format (e.g., 'USD', 'ARS')
    balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
    version INTEGER NOT NULL DEFAULT 1, -- For Optimistic Locking
    
    -- Foreign key constraint
    CONSTRAINT fk_accounts_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    type transaction_type_enum NOT NULL,
    amount NUMERIC(19, 4) NOT NULL,
    status transaction_status_enum NOT NULL DEFAULT 'PENDING',
    reference_id VARCHAR(255) UNIQUE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_transactions_account_id FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Add constraints for data integrity
-- Balance cannot be negative (unless explicitly allowed by business logic)
ALTER TABLE accounts ADD CONSTRAINT chk_accounts_balance_non_negative 
    CHECK (balance >= 0);

-- Amount in transactions must be positive
ALTER TABLE transactions ADD CONSTRAINT chk_transactions_amount_positive 
    CHECK (amount > 0);

-- Add comments for documentation
COMMENT ON TABLE users IS 'Users of the financial application';
COMMENT ON COLUMN users.id IS 'Unique identifier for the user';
COMMENT ON COLUMN users.email IS 'User email address (unique)';
COMMENT ON COLUMN users.password_hash IS 'Hashed password for authentication';
COMMENT ON COLUMN users.kyc_status IS 'KYC verification status';
COMMENT ON COLUMN users.created_at IS 'Timestamp when user was created';

COMMENT ON TABLE accounts IS 'User accounts with currency and balance';
COMMENT ON COLUMN accounts.id IS 'Unique identifier for the account';
COMMENT ON COLUMN accounts.user_id IS 'Reference to the user who owns this account';
COMMENT ON COLUMN accounts.currency IS 'Currency code in ISO 4217 format';
COMMENT ON COLUMN accounts.balance IS 'Account balance in NUMERIC(19, 4) format';
COMMENT ON COLUMN accounts.version IS 'Version number for optimistic locking';

COMMENT ON TABLE transactions IS 'Transaction history for accounts';
COMMENT ON COLUMN transactions.id IS 'Unique identifier for the transaction';
COMMENT ON COLUMN transactions.account_id IS 'Reference to the account involved in this transaction';
COMMENT ON COLUMN transactions.type IS 'Type of transaction (DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT)';
COMMENT ON COLUMN transactions.amount IS 'Transaction amount in NUMERIC(19, 4) format';
COMMENT ON COLUMN transactions.status IS 'Transaction status (PENDING, COMPLETED, FAILED)';
COMMENT ON COLUMN transactions.reference_id IS 'Unique reference from external provider';
COMMENT ON COLUMN transactions.metadata IS 'Additional data for AI categorization';
COMMENT ON COLUMN transactions.created_at IS 'Timestamp when transaction was created';