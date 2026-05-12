-- CreateTable: attendance_locations
CREATE TABLE "attendance_locations" (
    "id"                SERIAL NOT NULL,
    "employeeId"        INTEGER NOT NULL,
    "checkType"         VARCHAR(20) NOT NULL,
    "latitude"          DOUBLE PRECISION NOT NULL,
    "longitude"         DOUBLE PRECISION NOT NULL,
    "accuracy"          DOUBLE PRECISION,
    "ipAddress"         VARCHAR(64),
    "deviceType"        VARCHAR(64),
    "browser"           VARCHAR(128),
    "operatingSystem"   VARCHAR(128),
    "userAgent"         TEXT,
    "companyID"         INTEGER,
    "branchesID"        INTEGER,
    "serviceProviderID" INTEGER,
    "checkinTime"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_locations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "attendance_locations"
    ADD CONSTRAINT "attendance_locations_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "ManageEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "attendance_locations_employeeId_idx" ON "attendance_locations"("employeeId");
CREATE INDEX "attendance_locations_checkinTime_idx" ON "attendance_locations"("checkinTime");
CREATE INDEX "attendance_locations_checkType_idx" ON "attendance_locations"("checkType");
