-- CreateTable
CREATE TABLE "public"."Country" (
    "code" VARCHAR(2) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."State" (
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."ServiceProvider" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyName" VARCHAR(200) NOT NULL,
    "companyAddress" VARCHAR(500),
    "countryCode" VARCHAR(2) NOT NULL,
    "stateCode" VARCHAR(10) NOT NULL,
    "gstNo" VARCHAR(30),
    "contactNumber" VARCHAR(30),
    "emailAddress" VARCHAR(200),
    "website" VARCHAR(200),
    "companyLogoUrl" VARCHAR(500),

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."State" ADD CONSTRAINT "State_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "public"."Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceProvider" ADD CONSTRAINT "ServiceProvider_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "public"."Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceProvider" ADD CONSTRAINT "ServiceProvider_stateCode_fkey" FOREIGN KEY ("stateCode") REFERENCES "public"."State"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
