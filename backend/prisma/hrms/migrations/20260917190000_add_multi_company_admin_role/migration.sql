-- Add MULTI_COMPANY_ADMIN to UserRole enum (additive; no data rewrite)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MULTI_COMPANY_ADMIN';
