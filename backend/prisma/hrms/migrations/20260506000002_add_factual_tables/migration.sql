-- CreateTable: FactualWorkShift
CREATE TABLE IF NOT EXISTS "FactualWorkShift" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "workShiftName" VARCHAR,
    "isActive" VARCHAR,
    "workShiftType" VARCHAR,
    "isFlexible" BOOLEAN DEFAULT false,
    "isRotating" BOOLEAN DEFAULT false,
    "breakTimeMin" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FactualWorkShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FactualWorkShiftDay
CREATE TABLE IF NOT EXISTS "FactualWorkShiftDay" (
    "id" SERIAL NOT NULL,
    "factualWorkShiftID" INTEGER,
    "weekDay" VARCHAR,
    "shiftType" VARCHAR,
    "weeklyOff" BOOLEAN,
    "startTime" TEXT,
    "endTime" TEXT,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "totalMinutes" INTEGER,
    CONSTRAINT "FactualWorkShiftDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FactualAttendancePolicy
CREATE TABLE IF NOT EXISTS "FactualAttendancePolicy" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "attendancePolicyName" VARCHAR,
    "workingHoursType" VARCHAR,
    "checkin_begin_before_min" INTEGER,
    "checkout_end_after_min" INTEGER,
    "checkin_grace_time_min" INTEGER,
    "earlyCheckoutBeforeEndMin" INTEGER,
    "min_work_hours_half_day_min" INTEGER,
    "max_late_check_in_time" INTEGER,
    "markAs" TEXT,
    "lateMarkCount" TEXT,
    "allow_self_mark_attendance" BOOLEAN DEFAULT false,
    "allow_manager_update_ot" BOOLEAN DEFAULT false,
    "max_ot_hours_per_day_min" INTEGER,
    "checkoutGracePeriodForOvertimeTrimming" INTEGER DEFAULT 0,
    "breakTimeForOT" INTEGER DEFAULT 0,
    "otMealApply" BOOLEAN DEFAULT false,
    "maxOvertimeHrs" INTEGER DEFAULT 0,
    "minOvertimeHrs" INTEGER DEFAULT 0,
    "countWorkhoursInMinutes" BOOLEAN DEFAULT false,
    "overtimeApplicable" BOOLEAN DEFAULT false,
    "overtimeTrimmingApply" BOOLEAN DEFAULT false,
    "minsForOTMealToken" INTEGER DEFAULT 0,
    "minsForBreakTimeForMeal" INTEGER DEFAULT 0,
    "leaveAroundHolidayCounted" BOOLEAN DEFAULT false,
    "lateMarkMarkAs" TEXT,
    "lateMarkMarkCount" TEXT,
    "maxLateCheckinMarkAs" TEXT,
    "trimPreshiftMin" INTEGER DEFAULT 0,
    "trimPostshiftMin" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FactualAttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FactualRoster
CREATE TABLE IF NOT EXISTS "FactualRoster" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER NOT NULL,
    "companyID" INTEGER NOT NULL,
    "branchesID" INTEGER NOT NULL,
    "departmentID" INTEGER NOT NULL,
    "designationID" INTEGER,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "rosterPeriod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FactualRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FactualRosterEmployee
CREATE TABLE IF NOT EXISTS "FactualRosterEmployee" (
    "id" SERIAL NOT NULL,
    "factualRosterID" INTEGER NOT NULL,
    "employeeID" INTEGER NOT NULL,
    CONSTRAINT "FactualRosterEmployee_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FactualRosterEmployee_factualRosterID_employeeID_key" UNIQUE ("factualRosterID", "employeeID")
);

-- CreateTable: FactualRosterDay
CREATE TABLE IF NOT EXISTS "FactualRosterDay" (
    "id" SERIAL NOT NULL,
    "factualRosterEmployeeID" INTEGER NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "factualWorkShiftID" INTEGER,
    "dayType" TEXT NOT NULL,
    "leaveType" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FactualRosterDay_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FactualRosterDay_factualRosterEmployeeID_workDate_key" UNIQUE ("factualRosterEmployeeID", "workDate")
);

-- AddForeignKey: FactualWorkShiftDay -> FactualWorkShift
ALTER TABLE "FactualWorkShiftDay" ADD CONSTRAINT "FactualWorkShiftDay_factualWorkShiftID_fkey"
    FOREIGN KEY ("factualWorkShiftID") REFERENCES "FactualWorkShift"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey: FactualRosterEmployee -> FactualRoster
ALTER TABLE "FactualRosterEmployee" ADD CONSTRAINT "FactualRosterEmployee_factualRosterID_fkey"
    FOREIGN KEY ("factualRosterID") REFERENCES "FactualRoster"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey: FactualRosterDay -> FactualRosterEmployee
ALTER TABLE "FactualRosterDay" ADD CONSTRAINT "FactualRosterDay_factualRosterEmployeeID_fkey"
    FOREIGN KEY ("factualRosterEmployeeID") REFERENCES "FactualRosterEmployee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey: FactualRosterDay -> FactualWorkShift
ALTER TABLE "FactualRosterDay" ADD CONSTRAINT "FactualRosterDay_factualWorkShiftID_fkey"
    FOREIGN KEY ("factualWorkShiftID") REFERENCES "FactualWorkShift"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
