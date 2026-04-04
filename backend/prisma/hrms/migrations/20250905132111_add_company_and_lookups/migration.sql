-- CreateEnum
CREATE TYPE "public"."FinancialYearStart" AS ENUM ('JAN_1', 'APR_1');

-- CreateTable
CREATE TABLE "public"."TimeZone" (
    "id" VARCHAR(100) NOT NULL,
    "label" VARCHAR(120) NOT NULL,

    CONSTRAINT "TimeZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Currency" (
    "code" VARCHAR(3) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "symbol" VARCHAR(8),

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "serviceProviderId" TEXT,
    "countryCode" VARCHAR(2) NOT NULL,
    "stateCode" VARCHAR(10) NOT NULL,
    "timeZoneId" VARCHAR(100) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "companyName" VARCHAR(200) NOT NULL,
    "companyAddress" VARCHAR(500),
    "pfNo" VARCHAR(30),
    "tanNo" VARCHAR(30),
    "panNo" VARCHAR(15),
    "esiNo" VARCHAR(30),
    "linNo" VARCHAR(30),
    "gstNo" VARCHAR(30),
    "shopRegNo" VARCHAR(60),
    "financialYearStart" "public"."FinancialYearStart" NOT NULL,
    "contactNumber" VARCHAR(30),
    "emailAddress" VARCHAR(200),
    "companyLogoUrl" VARCHAR(500),
    "signatureUrl" VARCHAR(500),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_companyName_idx" ON "public"."Company"("companyName");

-- CreateIndex
CREATE INDEX "Company_countryCode_stateCode_idx" ON "public"."Company"("countryCode", "stateCode");

-- CreateIndex
CREATE INDEX "Company_serviceProviderId_idx" ON "public"."Company"("serviceProviderId");

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "public"."ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "public"."Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_stateCode_fkey" FOREIGN KEY ("stateCode") REFERENCES "public"."State"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_timeZoneId_fkey" FOREIGN KEY ("timeZoneId") REFERENCES "public"."TimeZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "public"."Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
