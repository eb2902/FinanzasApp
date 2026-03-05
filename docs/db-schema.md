# Database Schema & Data Integrity Rules

## Core Principles
1. **Money Handling**: NEVER use `float` or `double`. Use `NUMERIC(19, 4)` or `DECIMAL` for all currency amounts to avoid rounding errors.
2. **Auditability**: No record is ever truly deleted (Soft Delete). All balance changes must have a corresponding transaction log.
3. **Naming**: Use snake_case for tables and columns.

## Entities (PostgreSQL)

### Users Table
- `id`: UUID (Primary Key)
- `email`: String (Unique, Indexed)
- `password_hash`: String
- `kyc_status`: Enum (PENDING, VERIFIED, REJECTED)
- `created_at`: Timestamp with timezone

### Accounts Table
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key)
- `currency`: String (ISO 4217, e.g., 'USD', 'ARS')
- `balance`: NUMERIC(19, 4) (Default: 0.0000)
- `version`: Integer (For Optimistic Locking - prevents double-spending)

### Transactions Table
- `id`: UUID (Primary Key)
- `account_id`: UUID (Foreign Key)
- `type`: Enum (DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT)
- `amount`: NUMERIC(19, 4)
- `status`: Enum (PENDING, COMPLETED, FAILED)
- `reference_id`: String (Unique provider reference)
- `metadata`: JSONB (For flexible AI categorization data)
- `created_at`: Timestamp (Indexed)

## Constraints & Triggers
- **Balance Check**: A transaction cannot leave an account with a balance below zero (unless explicitly allowed).
- **Atomic Transfers**: Any transfer between two accounts must wrap both balance updates and the transaction log in a single SQL Transaction.

## AI Hint
When generating queries or migrations, always ensure `updated_at` timestamps are handled and that indices are created for `user_id` and `created_at` to optimize performance.