// Database models and types

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: Date;
}

export interface Account {
  id: string;
  userId: string;
  currency: string;
  balance: number;
  version: number;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'PAYMENT';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  referenceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface TransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  referenceId: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}
