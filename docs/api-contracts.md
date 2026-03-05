# API Design & Security Contracts

## General Specifications
- [cite_start]**Protocol**: RESTful API over HTTPS.
- **Format**: JSON (Standard for Request/Response).
- [cite_start]**Authentication**: Mandatory JWT (JSON Web Tokens) in `Authorization: Bearer <token>` header for all protected routes[cite: 16].
- **Rate Limiting**: 100 requests per minute per IP to prevent DoS.

## Core Endpoints (V1)

### 1. Authentication & Identity
- `POST /api/v1/auth/register`: User signup.
- [cite_start]`POST /api/v1/auth/login`: Identity verification and JWT issuance[cite: 16].
- `GET /api/v1/auth/me`: Retrieve current session user profile.

### 2. Account Management
- `GET /api/v1/accounts`: List all accounts for the authenticated user.
- `GET /api/v1/accounts/:id`: Detail of a specific account (Balance, Currency).

### 3. Financial Transactions
- `POST /api/v1/transactions`: Execute a new transaction (Deposit/Withdrawal/Transfer).
- [cite_start]`GET /api/v1/transactions`: History of transactions with filters (date, type, status)[cite: 14].
- [cite_start]**Requirement**: Use Atomic Transactions in DB to ensure data integrity.

### [cite_start]4. AI-Powered Services [cite: 16, 17]
- `POST /api/v1/ai/categorize`: Trigger AI categorization for a specific transaction description.
- [cite_start]`GET /api/v1/ai/projections`: Get predictive cash flow based on historical data[cite: 18].

## Response Error Codes
- `400 Bad Request`: Validation failed (e.g., negative amount).
- [cite_start]`401 Unauthorized`: Missing or invalid JWT[cite: 16].
- `403 Forbidden`: Authenticated user lacks permission for the resource.
- `422 Unprocessable Entity`: Business logic error (e.g., insufficient funds).

## AI Implementation Note
[cite_start]When implementing these endpoints, ensure all inputs are sanitized to prevent SQL Injection. [cite_start]Use TypeScript interfaces to enforce contract compliance between the frontend and the backend[cite: 34].