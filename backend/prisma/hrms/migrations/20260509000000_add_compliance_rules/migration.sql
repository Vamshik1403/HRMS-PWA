CREATE TABLE "ComplianceRule" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "ruleText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ComplianceRule"
ADD CONSTRAINT "ComplianceRule_serviceProviderID_fkey"
FOREIGN KEY ("serviceProviderID") REFERENCES "ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "ComplianceRule"
ADD CONSTRAINT "ComplianceRule_companyID_fkey"
FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX "ComplianceRule_serviceProviderID_idx" ON "ComplianceRule"("serviceProviderID");
CREATE INDEX "ComplianceRule_companyID_idx" ON "ComplianceRule"("companyID");
