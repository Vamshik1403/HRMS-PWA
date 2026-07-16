-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'CANCELLED', 'RENEWED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CONTRACTOR_ADMIN';

-- DropIndex
DROP INDEX "Devices_deviceSN_key";

-- AlterTable
ALTER TABLE "Devices" ALTER COLUMN "deviceSN" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "EmailTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GenerateSalary" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "CompanyModules";

-- CreateTable
CREATE TABLE "Module" (
    "id" SERIAL NOT NULL,
    "moduleKey" VARCHAR(100) NOT NULL,
    "moduleName" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyModule" (
    "id" SERIAL NOT NULL,
    "companyID" INTEGER NOT NULL,
    "moduleID" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorBranch" (
    "id" SERIAL NOT NULL,
    "contractorID" INTEGER NOT NULL,
    "branchID" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" SERIAL NOT NULL,
    "employeeID" INTEGER NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "documentName" VARCHAR(200) NOT NULL,
    "documentCategory" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileName" VARCHAR(255),
    "fileUrl" VARCHAR(500),
    "fileType" VARCHAR(100),
    "fileSize" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpAbsentDeclaration" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "absentDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "leaveType" VARCHAR(32) NOT NULL,
    "leaveApplicationId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpAbsentDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCustomer" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "customerCode" VARCHAR(32) NOT NULL,
    "customerName" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(128),
    "state" VARCHAR(128),
    "pincode" VARCHAR(32),
    "country" VARCHAR(128),
    "createdByUserID" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCustomerSite" (
    "id" SERIAL NOT NULL,
    "customerID" INTEGER NOT NULL,
    "branchName" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(128),
    "state" VARCHAR(128),
    "pincode" VARCHAR(32),
    "country" VARCHAR(128),
    "latitude" VARCHAR(64),
    "longitude" VARCHAR(64),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCustomerSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskProject" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "taskCode" VARCHAR(32) NOT NULL,
    "departmentID" INTEGER,
    "taskType" VARCHAR(64) NOT NULL,
    "customerID" INTEGER,
    "siteID" INTEGER,
    "taskName" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "scheduleDateTime" TIMESTAMP(3),
    "priority" VARCHAR(32) NOT NULL DEFAULT 'Medium',
    "dueDateTime" TIMESTAMP(3),
    "status" VARCHAR(32) NOT NULL DEFAULT 'Open',
    "createdByUserID" INTEGER,
    "createdByEmployeeID" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" SERIAL NOT NULL,
    "taskID" INTEGER NOT NULL,
    "manageEmployeeID" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskRemark" (
    "id" SERIAL NOT NULL,
    "taskID" INTEGER NOT NULL,
    "userID" INTEGER,
    "employeeID" INTEGER,
    "authorName" VARCHAR(255),
    "remark" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRemark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskChat" (
    "id" SERIAL NOT NULL,
    "taskID" INTEGER NOT NULL,
    "userID" INTEGER,
    "employeeID" INTEGER,
    "recipientEmployeeID" INTEGER,
    "senderName" VARCHAR(255),
    "message" TEXT NOT NULL,
    "attachmentUrl" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskActivityLog" (
    "id" SERIAL NOT NULL,
    "taskID" INTEGER NOT NULL,
    "userID" INTEGER,
    "employeeID" INTEGER,
    "actorName" VARCHAR(255),
    "action" VARCHAR(64) NOT NULL,
    "oldValue" VARCHAR(255),
    "newValue" VARCHAR(255),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "username" VARCHAR(255),
    "employeeName" VARCHAR(255),
    "userRole" VARCHAR(64),
    "action" VARCHAR(64) NOT NULL,
    "module" VARCHAR(64) NOT NULL,
    "entityId" VARCHAR(64),
    "entityName" VARCHAR(255),
    "oldData" TEXT,
    "newData" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failureReason" VARCHAR(512),
    "ipAddress" VARCHAR(64),
    "browser" VARCHAR(128),
    "os" VARCHAR(128),
    "deviceType" VARCHAR(64),
    "location" VARCHAR(255),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRestoreLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "username" VARCHAR(255),
    "backupDate" VARCHAR(16) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileLabel" VARCHAR(255),
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "ipAddress" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupRestoreLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" SERIAL NOT NULL,
    "planName" TEXT NOT NULL,
    "validityDays" INTEGER NOT NULL DEFAULT 30,
    "planAmount" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlanModule" (
    "id" SERIAL NOT NULL,
    "planID" INTEGER NOT NULL,
    "moduleID" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPlanModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySubscription" (
    "id" SERIAL NOT NULL,
    "companyID" INTEGER NOT NULL,
    "planID" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "deactivationWef" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "renewedFromID" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Module_moduleKey_key" ON "Module"("moduleKey");

-- CreateIndex
CREATE INDEX "CompanyModule_companyID_idx" ON "CompanyModule"("companyID");

-- CreateIndex
CREATE INDEX "CompanyModule_moduleID_idx" ON "CompanyModule"("moduleID");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyModule_companyID_moduleID_key" ON "CompanyModule"("companyID", "moduleID");

-- CreateIndex
CREATE INDEX "ContractorBranch_contractorID_idx" ON "ContractorBranch"("contractorID");

-- CreateIndex
CREATE INDEX "ContractorBranch_branchID_idx" ON "ContractorBranch"("branchID");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorBranch_contractorID_branchID_key" ON "ContractorBranch"("contractorID", "branchID");

-- CreateIndex
CREATE INDEX "employee_documents_employeeID_idx" ON "employee_documents"("employeeID");

-- CreateIndex
CREATE INDEX "employee_documents_companyID_idx" ON "employee_documents"("companyID");

-- CreateIndex
CREATE INDEX "employee_documents_branchesID_idx" ON "employee_documents"("branchesID");

-- CreateIndex
CREATE INDEX "employee_documents_documentCategory_idx" ON "employee_documents"("documentCategory");

-- CreateIndex
CREATE INDEX "EmpAbsentDeclaration_employeeId_idx" ON "EmpAbsentDeclaration"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpAbsentDeclaration_employeeId_absentDate_key" ON "EmpAbsentDeclaration"("employeeId", "absentDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCustomer_customerCode_key" ON "TaskCustomer"("customerCode");

-- CreateIndex
CREATE INDEX "TaskCustomer_companyID_idx" ON "TaskCustomer"("companyID");

-- CreateIndex
CREATE INDEX "TaskCustomer_customerName_idx" ON "TaskCustomer"("customerName");

-- CreateIndex
CREATE INDEX "TaskCustomer_isDeleted_idx" ON "TaskCustomer"("isDeleted");

-- CreateIndex
CREATE INDEX "TaskCustomerSite_customerID_idx" ON "TaskCustomerSite"("customerID");

-- CreateIndex
CREATE INDEX "TaskCustomerSite_isDeleted_idx" ON "TaskCustomerSite"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "TaskProject_taskCode_key" ON "TaskProject"("taskCode");

-- CreateIndex
CREATE INDEX "TaskProject_companyID_idx" ON "TaskProject"("companyID");

-- CreateIndex
CREATE INDEX "TaskProject_status_idx" ON "TaskProject"("status");

-- CreateIndex
CREATE INDEX "TaskProject_customerID_idx" ON "TaskProject"("customerID");

-- CreateIndex
CREATE INDEX "TaskProject_siteID_idx" ON "TaskProject"("siteID");

-- CreateIndex
CREATE INDEX "TaskProject_createdByEmployeeID_idx" ON "TaskProject"("createdByEmployeeID");

-- CreateIndex
CREATE INDEX "TaskProject_isDeleted_idx" ON "TaskProject"("isDeleted");

-- CreateIndex
CREATE INDEX "TaskAssignment_manageEmployeeID_idx" ON "TaskAssignment"("manageEmployeeID");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskID_manageEmployeeID_key" ON "TaskAssignment"("taskID", "manageEmployeeID");

-- CreateIndex
CREATE INDEX "TaskRemark_taskID_idx" ON "TaskRemark"("taskID");

-- CreateIndex
CREATE INDEX "TaskChat_taskID_idx" ON "TaskChat"("taskID");

-- CreateIndex
CREATE INDEX "TaskChat_createdAt_idx" ON "TaskChat"("createdAt");

-- CreateIndex
CREATE INDEX "TaskChat_recipientEmployeeID_idx" ON "TaskChat"("recipientEmployeeID");

-- CreateIndex
CREATE INDEX "TaskActivityLog_taskID_idx" ON "TaskActivityLog"("taskID");

-- CreateIndex
CREATE INDEX "TaskActivityLog_createdAt_idx" ON "TaskActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_module_createdAt_idx" ON "AuditLog"("module", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_username_createdAt_idx" ON "AuditLog"("username", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "BackupRestoreLog_createdAt_idx" ON "BackupRestoreLog"("createdAt");

-- CreateIndex
CREATE INDEX "BackupRestoreLog_username_idx" ON "BackupRestoreLog"("username");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_planName_key" ON "SubscriptionPlan"("planName");

-- CreateIndex
CREATE INDEX "SubscriptionPlanModule_planID_idx" ON "SubscriptionPlanModule"("planID");

-- CreateIndex
CREATE INDEX "SubscriptionPlanModule_moduleID_idx" ON "SubscriptionPlanModule"("moduleID");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlanModule_planID_moduleID_key" ON "SubscriptionPlanModule"("planID", "moduleID");

-- CreateIndex
CREATE INDEX "CompanySubscription_companyID_idx" ON "CompanySubscription"("companyID");

-- CreateIndex
CREATE INDEX "CompanySubscription_planID_idx" ON "CompanySubscription"("planID");

-- CreateIndex
CREATE INDEX "CompanySubscription_status_idx" ON "CompanySubscription"("status");

-- CreateIndex
CREATE INDEX "CompanySubscription_startDate_idx" ON "CompanySubscription"("startDate");

-- CreateIndex
CREATE INDEX "CompanySubscription_endDate_idx" ON "CompanySubscription"("endDate");

-- CreateIndex
CREATE INDEX "EmployeeMemo_parentMemoId_idx" ON "EmployeeMemo"("parentMemoId");

-- CreateIndex
CREATE INDEX "EmployeeMemo_senderEmployeeId_idx" ON "EmployeeMemo"("senderEmployeeId");

-- AddForeignKey
ALTER TABLE "BonusAllocation" ADD CONSTRAINT "BonusAllocation_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BonusAllocation" ADD CONSTRAINT "BonusAllocation_departmentID_fkey" FOREIGN KEY ("departmentID") REFERENCES "Departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_moduleID_fkey" FOREIGN KEY ("moduleID") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorBranch" ADD CONSTRAINT "ContractorBranch_contractorID_fkey" FOREIGN KEY ("contractorID") REFERENCES "Contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorBranch" ADD CONSTRAINT "ContractorBranch_branchID_fkey" FOREIGN KEY ("branchID") REFERENCES "Branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpAttendanceRegularise" ADD CONSTRAINT "EmpAttendanceRegularise_departmentID_fkey" FOREIGN KEY ("departmentID") REFERENCES "Departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeID_fkey" FOREIGN KEY ("employeeID") REFERENCES "ManageEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "Branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_departmentID_fkey" FOREIGN KEY ("departmentID") REFERENCES "Departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_contractorID_fkey" FOREIGN KEY ("contractorID") REFERENCES "Contractors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpAbsentDeclaration" ADD CONSTRAINT "EmpAbsentDeclaration_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "ManageEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCustomer" ADD CONSTRAINT "TaskCustomer_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TaskCustomer" ADD CONSTRAINT "TaskCustomer_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TaskCustomer" ADD CONSTRAINT "TaskCustomer_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TaskCustomerSite" ADD CONSTRAINT "TaskCustomerSite_customerID_fkey" FOREIGN KEY ("customerID") REFERENCES "TaskCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_departmentID_fkey" FOREIGN KEY ("departmentID") REFERENCES "Departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_customerID_fkey" FOREIGN KEY ("customerID") REFERENCES "TaskCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_siteID_fkey" FOREIGN KEY ("siteID") REFERENCES "TaskCustomerSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_createdByEmployeeID_fkey" FOREIGN KEY ("createdByEmployeeID") REFERENCES "ManageEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskID_fkey" FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "ManageEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRemark" ADD CONSTRAINT "TaskRemark_taskID_fkey" FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChat" ADD CONSTRAINT "TaskChat_taskID_fkey" FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_taskID_fkey" FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlanModule" ADD CONSTRAINT "SubscriptionPlanModule_planID_fkey" FOREIGN KEY ("planID") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlanModule" ADD CONSTRAINT "SubscriptionPlanModule_moduleID_fkey" FOREIGN KEY ("moduleID") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_renewedFromID_fkey" FOREIGN KEY ("renewedFromID") REFERENCES "CompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_planID_fkey" FOREIGN KEY ("planID") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

