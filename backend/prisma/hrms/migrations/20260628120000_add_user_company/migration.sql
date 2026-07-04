-- CreateTable
CREATE TABLE IF NOT EXISTS "UserCompany" (
    "id" SERIAL NOT NULL,
    "userID" INTEGER NOT NULL,
    "companyID" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserCompany_userID_companyID_key" ON "UserCompany"("userID", "companyID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserCompany_userID_idx" ON "UserCompany"("userID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserCompany_companyID_idx" ON "UserCompany"("companyID");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserCompany_userID_fkey') THEN
    ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserCompany_companyID_fkey') THEN
    ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
