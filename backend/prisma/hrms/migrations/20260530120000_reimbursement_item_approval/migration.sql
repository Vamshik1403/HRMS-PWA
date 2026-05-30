-- Per-line reimbursement approval and payment tracking
ALTER TABLE "ReimbursementItem" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Pending';
ALTER TABLE "ReimbursementItem" ADD COLUMN IF NOT EXISTS "approvalType" TEXT;
ALTER TABLE "ReimbursementItem" ADD COLUMN IF NOT EXISTS "paidStatus" TEXT;
ALTER TABLE "ReimbursementItem" ADD COLUMN IF NOT EXISTS "paymentRemark" TEXT;
