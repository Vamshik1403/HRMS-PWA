-- Task Management System

CREATE TABLE IF NOT EXISTS "TaskCustomer" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
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

CREATE UNIQUE INDEX IF NOT EXISTS "TaskCustomer_customerCode_key" ON "TaskCustomer"("customerCode");
CREATE INDEX IF NOT EXISTS "TaskCustomer_companyID_idx" ON "TaskCustomer"("companyID");
CREATE INDEX IF NOT EXISTS "TaskCustomer_customerName_idx" ON "TaskCustomer"("customerName");
CREATE INDEX IF NOT EXISTS "TaskCustomer_isDeleted_idx" ON "TaskCustomer"("isDeleted");

CREATE TABLE IF NOT EXISTS "TaskCustomerSite" (
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

CREATE INDEX IF NOT EXISTS "TaskCustomerSite_customerID_idx" ON "TaskCustomerSite"("customerID");
CREATE INDEX IF NOT EXISTS "TaskCustomerSite_isDeleted_idx" ON "TaskCustomerSite"("isDeleted");

CREATE TABLE IF NOT EXISTS "TaskProject" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "TaskProject_taskCode_key" ON "TaskProject"("taskCode");
CREATE INDEX IF NOT EXISTS "TaskProject_companyID_idx" ON "TaskProject"("companyID");
CREATE INDEX IF NOT EXISTS "TaskProject_status_idx" ON "TaskProject"("status");
CREATE INDEX IF NOT EXISTS "TaskProject_customerID_idx" ON "TaskProject"("customerID");
CREATE INDEX IF NOT EXISTS "TaskProject_siteID_idx" ON "TaskProject"("siteID");
CREATE INDEX IF NOT EXISTS "TaskProject_createdByEmployeeID_idx" ON "TaskProject"("createdByEmployeeID");
CREATE INDEX IF NOT EXISTS "TaskProject_isDeleted_idx" ON "TaskProject"("isDeleted");

CREATE TABLE IF NOT EXISTS "TaskAssignment" (
    "id" SERIAL NOT NULL,
    "taskID" INTEGER NOT NULL,
    "manageEmployeeID" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskAssignment_taskID_manageEmployeeID_key" ON "TaskAssignment"("taskID", "manageEmployeeID");
CREATE INDEX IF NOT EXISTS "TaskAssignment_manageEmployeeID_idx" ON "TaskAssignment"("manageEmployeeID");

CREATE TABLE IF NOT EXISTS "TaskRemark" (
    "id" SERIAL NOT NULL,
    "taskID" INTEGER NOT NULL,
    "userID" INTEGER,
    "employeeID" INTEGER,
    "authorName" VARCHAR(255),
    "remark" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskRemark_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TaskRemark_taskID_idx" ON "TaskRemark"("taskID");

CREATE TABLE IF NOT EXISTS "TaskChat" (
    "id" SERIAL NOT NULL,
    "taskID" INTEGER NOT NULL,
    "userID" INTEGER,
    "employeeID" INTEGER,
    "senderName" VARCHAR(255),
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskChat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TaskChat_taskID_idx" ON "TaskChat"("taskID");
CREATE INDEX IF NOT EXISTS "TaskChat_createdAt_idx" ON "TaskChat"("createdAt");

CREATE TABLE IF NOT EXISTS "TaskActivityLog" (
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

CREATE INDEX IF NOT EXISTS "TaskActivityLog_taskID_idx" ON "TaskActivityLog"("taskID");
CREATE INDEX IF NOT EXISTS "TaskActivityLog_createdAt_idx" ON "TaskActivityLog"("createdAt");

ALTER TABLE "TaskCustomer" ADD CONSTRAINT "TaskCustomer_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "TaskCustomer" ADD CONSTRAINT "TaskCustomer_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "TaskCustomerSite" ADD CONSTRAINT "TaskCustomerSite_customerID_fkey" FOREIGN KEY ("customerID") REFERENCES "TaskCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_departmentID_fkey" FOREIGN KEY ("departmentID") REFERENCES "Departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_customerID_fkey" FOREIGN KEY ("customerID") REFERENCES "TaskCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_siteID_fkey" FOREIGN KEY ("siteID") REFERENCES "TaskCustomerSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_createdByEmployeeID_fkey" FOREIGN KEY ("createdByEmployeeID") REFERENCES "ManageEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskID_fkey" FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "ManageEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskRemark" ADD CONSTRAINT "TaskRemark_taskID_fkey" FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskChat" ADD CONSTRAINT "TaskChat_taskID_fkey" FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_taskID_fkey" FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
