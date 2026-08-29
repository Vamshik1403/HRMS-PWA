-- ERP field contract for TaskCustomer / TaskCustomerSite / TaskProject

ALTER TABLE "TaskCustomer"
  ALTER COLUMN "customerCode" TYPE VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "addressType" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "gstNo" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "erpAddressBookId" INTEGER,
  ADD COLUMN IF NOT EXISTS "relationshipManagerName" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "relationshipManagerEmail" VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskCustomer_erpAddressBookId_key"
  ON "TaskCustomer"("erpAddressBookId");

ALTER TABLE "TaskCustomerSite"
  ADD COLUMN IF NOT EXISTS "companyID" INTEGER,
  ADD COLUMN IF NOT EXISTS "siteCode" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "erpSiteId" INTEGER,
  ADD COLUMN IF NOT EXISTS "gstNo" VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskCustomerSite_siteCode_key"
  ON "TaskCustomerSite"("siteCode");
CREATE UNIQUE INDEX IF NOT EXISTS "TaskCustomerSite_erpSiteId_key"
  ON "TaskCustomerSite"("erpSiteId");
CREATE INDEX IF NOT EXISTS "TaskCustomerSite_companyID_idx"
  ON "TaskCustomerSite"("companyID");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskCustomerSite_companyID_fkey'
  ) THEN
    ALTER TABLE "TaskCustomerSite"
      ADD CONSTRAINT "TaskCustomerSite_companyID_fkey"
      FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

ALTER TABLE "TaskProject"
  ALTER COLUMN "taskCode" TYPE VARCHAR(64),
  ALTER COLUMN "status" TYPE VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "erpTaskId" INTEGER,
  ADD COLUMN IF NOT EXISTS "attachment" VARCHAR(512),
  ADD COLUMN IF NOT EXISTS "createdByName" VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskProject_erpTaskId_key"
  ON "TaskProject"("erpTaskId");

ALTER TABLE "TaskRemark"
  ADD COLUMN IF NOT EXISTS "createdBy" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(64);

CREATE TABLE IF NOT EXISTS "TaskCustomerContact" (
  "id" SERIAL PRIMARY KEY,
  "customerID" INTEGER NOT NULL,
  "contactPerson" VARCHAR(255) NOT NULL,
  "contactNumber" VARCHAR(64) NOT NULL,
  "designation" VARCHAR(128),
  "email" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskCustomerContact_customerID_fkey"
    FOREIGN KEY ("customerID") REFERENCES "TaskCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskCustomerContact_customerID_idx" ON "TaskCustomerContact"("customerID");

CREATE TABLE IF NOT EXISTS "TaskCustomerSiteContact" (
  "id" SERIAL PRIMARY KEY,
  "siteID" INTEGER NOT NULL,
  "contactPerson" VARCHAR(255) NOT NULL,
  "contactNumber" VARCHAR(64) NOT NULL,
  "designation" VARCHAR(128),
  "email" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskCustomerSiteContact_siteID_fkey"
    FOREIGN KEY ("siteID") REFERENCES "TaskCustomerSite"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskCustomerSiteContact_siteID_idx" ON "TaskCustomerSiteContact"("siteID");

CREATE TABLE IF NOT EXISTS "TaskCustomerSiteNote" (
  "id" SERIAL PRIMARY KEY,
  "siteID" INTEGER NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "createdBy" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskCustomerSiteNote_siteID_fkey"
    FOREIGN KEY ("siteID") REFERENCES "TaskCustomerSite"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskCustomerSiteNote_siteID_idx" ON "TaskCustomerSiteNote"("siteID");

CREATE TABLE IF NOT EXISTS "TaskWorkscopeCategory" (
  "id" SERIAL PRIMARY KEY,
  "companyID" INTEGER,
  "workscopeCategoryName" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskWorkscopeCategory_companyID_fkey"
    FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS "TaskWorkscopeCategory_companyID_workscopeCategoryName_key"
  ON "TaskWorkscopeCategory"("companyID", "workscopeCategoryName");
CREATE INDEX IF NOT EXISTS "TaskWorkscopeCategory_companyID_idx" ON "TaskWorkscopeCategory"("companyID");

CREATE TABLE IF NOT EXISTS "TaskProduct" (
  "id" SERIAL PRIMARY KEY,
  "companyID" INTEGER,
  "productName" VARCHAR(255) NOT NULL,
  "productCode" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskProduct_companyID_fkey"
    FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS "TaskProduct_companyID_productName_key"
  ON "TaskProduct"("companyID", "productName");
CREATE INDEX IF NOT EXISTS "TaskProduct_companyID_idx" ON "TaskProduct"("companyID");

CREATE TABLE IF NOT EXISTS "TaskEngineerAssignment" (
  "id" SERIAL PRIMARY KEY,
  "taskID" INTEGER NOT NULL,
  "manageEmployeeID" INTEGER,
  "engineerName" VARCHAR(255),
  "engineerEmail" VARCHAR(255),
  "engineerPhone" VARCHAR(64),
  "proposedDateTime" TIMESTAMP(3),
  "priority" VARCHAR(32),
  "status" VARCHAR(64),
  "notes" TEXT,
  "assignedDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskEngineerAssignment_taskID_fkey"
    FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskEngineerAssignment_manageEmployeeID_fkey"
    FOREIGN KEY ("manageEmployeeID") REFERENCES "ManageEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskEngineerAssignment_taskID_idx" ON "TaskEngineerAssignment"("taskID");
CREATE INDEX IF NOT EXISTS "TaskEngineerAssignment_manageEmployeeID_idx" ON "TaskEngineerAssignment"("manageEmployeeID");

CREATE TABLE IF NOT EXISTS "TaskProjectContact" (
  "id" SERIAL PRIMARY KEY,
  "taskID" INTEGER NOT NULL,
  "contactName" VARCHAR(255) NOT NULL,
  "contactNumber" VARCHAR(64) NOT NULL,
  "contactEmail" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskProjectContact_taskID_fkey"
    FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskProjectContact_taskID_idx" ON "TaskProjectContact"("taskID");

CREATE TABLE IF NOT EXISTS "TaskWorkscopeDetail" (
  "id" SERIAL PRIMARY KEY,
  "taskID" INTEGER NOT NULL,
  "workscopeCategoryID" INTEGER,
  "workscopeDetails" TEXT,
  "extraNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskWorkscopeDetail_taskID_fkey"
    FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskWorkscopeDetail_workscopeCategoryID_fkey"
    FOREIGN KEY ("workscopeCategoryID") REFERENCES "TaskWorkscopeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskWorkscopeDetail_taskID_idx" ON "TaskWorkscopeDetail"("taskID");

CREATE TABLE IF NOT EXISTS "TaskSchedule" (
  "id" SERIAL PRIMARY KEY,
  "taskID" INTEGER NOT NULL,
  "proposedDateTime" TIMESTAMP(3),
  "priority" VARCHAR(32),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskSchedule_taskID_fkey"
    FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskSchedule_taskID_idx" ON "TaskSchedule"("taskID");

CREATE TABLE IF NOT EXISTS "TaskImage" (
  "id" SERIAL PRIMARY KEY,
  "taskID" INTEGER NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "filepath" VARCHAR(512),
  "fileUrl" VARCHAR(1024),
  "mimeType" VARCHAR(128),
  "fileSize" INTEGER,
  "uploadedBy" VARCHAR(255),
  "uploadedByName" VARCHAR(255),
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "erpFilepath" VARCHAR(512),
  CONSTRAINT "TaskImage_taskID_fkey"
    FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskImage_taskID_idx" ON "TaskImage"("taskID");

CREATE TABLE IF NOT EXISTS "TaskNote" (
  "id" SERIAL PRIMARY KEY,
  "taskID" INTEGER NOT NULL,
  "filename" VARCHAR(255),
  "title" VARCHAR(255),
  "description" TEXT,
  "filepath" VARCHAR(512),
  "fileUrl" VARCHAR(1024),
  "mimeType" VARCHAR(128),
  "fileSize" INTEGER,
  "note" TEXT,
  "uploadedBy" VARCHAR(255),
  "uploadedByName" VARCHAR(255),
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "erpFilepath" VARCHAR(512),
  CONSTRAINT "TaskNote_taskID_fkey"
    FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskNote_taskID_idx" ON "TaskNote"("taskID");

CREATE TABLE IF NOT EXISTS "TaskInventory" (
  "id" SERIAL PRIMARY KEY,
  "taskID" INTEGER NOT NULL,
  "productTypeId" INTEGER,
  "makeModel" VARCHAR(255),
  "snMac" VARCHAR(255),
  "description" TEXT,
  "purchaseDate" TIMESTAMP(3),
  "warrantyPeriod" VARCHAR(128),
  "warrantyStatus" VARCHAR(32),
  "thirdPartyPurchase" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskInventory_taskID_fkey"
    FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskInventory_productTypeId_fkey"
    FOREIGN KEY ("productTypeId") REFERENCES "TaskProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskInventory_taskID_idx" ON "TaskInventory"("taskID");

CREATE TABLE IF NOT EXISTS "TaskPurchase" (
  "id" SERIAL PRIMARY KEY,
  "taskID" INTEGER NOT NULL UNIQUE,
  "purchaseType" VARCHAR(32),
  "customerName" VARCHAR(255),
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskPurchase_taskID_fkey"
    FOREIGN KEY ("taskID") REFERENCES "TaskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TaskPurchaseProduct" (
  "id" SERIAL PRIMARY KEY,
  "taskPurchaseID" INTEGER NOT NULL,
  "make" VARCHAR(255),
  "model" VARCHAR(255),
  "description" TEXT,
  "warranty" VARCHAR(128),
  "rate" VARCHAR(64),
  "vendor" VARCHAR(255),
  "validity" VARCHAR(128),
  "availability" VARCHAR(128),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskPurchaseProduct_taskPurchaseID_fkey"
    FOREIGN KEY ("taskPurchaseID") REFERENCES "TaskPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskPurchaseProduct_taskPurchaseID_idx" ON "TaskPurchaseProduct"("taskPurchaseID");

CREATE TABLE IF NOT EXISTS "TaskPurchaseAttachment" (
  "id" SERIAL PRIMARY KEY,
  "taskPurchaseID" INTEGER NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "filepath" VARCHAR(512),
  "fileUrl" VARCHAR(1024),
  "mimeType" VARCHAR(128),
  "fileSize" INTEGER,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "erpFilepath" VARCHAR(512),
  CONSTRAINT "TaskPurchaseAttachment_taskPurchaseID_fkey"
    FOREIGN KEY ("taskPurchaseID") REFERENCES "TaskPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TaskPurchaseAttachment_taskPurchaseID_idx" ON "TaskPurchaseAttachment"("taskPurchaseID");
