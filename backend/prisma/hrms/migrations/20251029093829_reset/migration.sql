/*
  Warnings:

  - The primary key for the `Company` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `companyAddress` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `contactNumber` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `countryCode` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `currencyCode` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `emailAddress` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `serviceProviderId` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `signatureUrl` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `stateCode` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `timeZoneId` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Company` table. All the data in the column will be lost.
  - The `id` column on the `Company` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `financialYearStart` column on the `Company` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `ServiceProvider` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `contactNumber` on the `ServiceProvider` table. All the data in the column will be lost.
  - You are about to drop the column `countryCode` on the `ServiceProvider` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ServiceProvider` table. All the data in the column will be lost.
  - You are about to drop the column `emailAddress` on the `ServiceProvider` table. All the data in the column will be lost.
  - You are about to drop the column `stateCode` on the `ServiceProvider` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ServiceProvider` table. All the data in the column will be lost.
  - The `id` column on the `ServiceProvider` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Country` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Currency` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `State` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TimeZone` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."DeviceStatus" AS ENUM ('Active', 'Inactive');

-- DropForeignKey
ALTER TABLE "public"."Company" DROP CONSTRAINT "Company_countryCode_fkey";

-- DropForeignKey
ALTER TABLE "public"."Company" DROP CONSTRAINT "Company_currencyCode_fkey";

-- DropForeignKey
ALTER TABLE "public"."Company" DROP CONSTRAINT "Company_serviceProviderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Company" DROP CONSTRAINT "Company_stateCode_fkey";

-- DropForeignKey
ALTER TABLE "public"."Company" DROP CONSTRAINT "Company_timeZoneId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceProvider" DROP CONSTRAINT "ServiceProvider_countryCode_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceProvider" DROP CONSTRAINT "ServiceProvider_stateCode_fkey";

-- DropForeignKey
ALTER TABLE "public"."State" DROP CONSTRAINT "State_countryCode_fkey";

-- DropIndex
DROP INDEX "public"."Company_companyName_idx";

-- DropIndex
DROP INDEX "public"."Company_countryCode_stateCode_idx";

-- DropIndex
DROP INDEX "public"."Company_serviceProviderId_idx";

-- AlterTable
ALTER TABLE "public"."Company" DROP CONSTRAINT "Company_pkey",
DROP COLUMN "companyAddress",
DROP COLUMN "contactNumber",
DROP COLUMN "countryCode",
DROP COLUMN "createdAt",
DROP COLUMN "currencyCode",
DROP COLUMN "emailAddress",
DROP COLUMN "serviceProviderId",
DROP COLUMN "signatureUrl",
DROP COLUMN "stateCode",
DROP COLUMN "timeZoneId",
DROP COLUMN "updatedAt",
ADD COLUMN     "SignatureUrl" VARCHAR,
ADD COLUMN     "address" VARCHAR,
ADD COLUMN     "contactNo" VARCHAR,
ADD COLUMN     "country" VARCHAR,
ADD COLUMN     "currency" VARCHAR,
ADD COLUMN     "emailAdd" VARCHAR,
ADD COLUMN     "serviceProviderID" INTEGER,
ADD COLUMN     "state" VARCHAR,
ADD COLUMN     "timeZone" VARCHAR,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "companyName" DROP NOT NULL,
ALTER COLUMN "companyName" SET DATA TYPE VARCHAR,
ALTER COLUMN "pfNo" SET DATA TYPE VARCHAR,
ALTER COLUMN "tanNo" SET DATA TYPE VARCHAR,
ALTER COLUMN "panNo" SET DATA TYPE VARCHAR,
ALTER COLUMN "esiNo" SET DATA TYPE VARCHAR,
ALTER COLUMN "linNo" SET DATA TYPE VARCHAR,
ALTER COLUMN "gstNo" SET DATA TYPE VARCHAR,
ALTER COLUMN "shopRegNo" SET DATA TYPE VARCHAR,
DROP COLUMN "financialYearStart",
ADD COLUMN     "financialYearStart" VARCHAR,
ALTER COLUMN "companyLogoUrl" SET DATA TYPE VARCHAR,
ADD CONSTRAINT "Company_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."ServiceProvider" DROP CONSTRAINT "ServiceProvider_pkey",
DROP COLUMN "contactNumber",
DROP COLUMN "countryCode",
DROP COLUMN "createdAt",
DROP COLUMN "emailAddress",
DROP COLUMN "stateCode",
DROP COLUMN "updatedAt",
ADD COLUMN     "contactNo" VARCHAR,
ADD COLUMN     "country" VARCHAR,
ADD COLUMN     "created_at" TIMESTAMP(6),
ADD COLUMN     "emailAdd" VARCHAR,
ADD COLUMN     "state" VARCHAR,
ADD COLUMN     "updated_at" TIMESTAMP(6),
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "companyName" DROP NOT NULL,
ALTER COLUMN "companyName" SET DATA TYPE VARCHAR,
ALTER COLUMN "companyAddress" SET DATA TYPE VARCHAR,
ALTER COLUMN "gstNo" SET DATA TYPE VARCHAR,
ALTER COLUMN "website" SET DATA TYPE VARCHAR,
ALTER COLUMN "companyLogoUrl" SET DATA TYPE VARCHAR,
ADD CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "public"."Country";

-- DropTable
DROP TABLE "public"."Currency";

-- DropTable
DROP TABLE "public"."State";

-- DropTable
DROP TABLE "public"."TimeZone";

-- DropEnum
DROP TYPE "public"."FinancialYearStart";

-- CreateTable
CREATE TABLE "public"."AttendancePolicy" (
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

    CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BankDetails" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER NOT NULL,
    "bankName" VARCHAR,
    "bankBranchName" VARCHAR,
    "accountNo" VARCHAR,
    "ifscCode" VARCHAR,

    CONSTRAINT "BankDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BonusSetup" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "bonusName" VARCHAR,
    "bonusType" VARCHAR,
    "bonusDescription" VARCHAR,
    "bonusBasedOn" VARCHAR,
    "bonusPercentage" VARCHAR,
    "bonusFixed" VARCHAR,

    CONSTRAINT "BonusSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BonusAllocation" (
    "id" SERIAL NOT NULL,
    "bonusSetupID" INTEGER NOT NULL,
    "financialYear" INTEGER,
    "salaryPeriod" INTEGER,
    "employeeID" INTEGER NOT NULL,

    CONSTRAINT "BonusAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Branches" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchName" VARCHAR,
    "address" VARCHAR,
    "country" VARCHAR,
    "state" VARCHAR,
    "timeZone" VARCHAR,
    "currency" VARCHAR,
    "pfNo" VARCHAR,
    "tanNo" VARCHAR,
    "esiNo" VARCHAR,
    "linNo" VARCHAR,
    "gstNo" VARCHAR,
    "shopRegNo" VARCHAR,
    "financialYearStart" VARCHAR,
    "contactNo" VARCHAR,
    "emailAdd" VARCHAR,
    "companyLogoUrl" VARCHAR,
    "SignatureUrl" VARCHAR,

    CONSTRAINT "Branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contractors" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "contractorName" VARCHAR,
    "address" VARCHAR,
    "country" VARCHAR,
    "state" VARCHAR,
    "timeZone" VARCHAR,
    "currency" VARCHAR,
    "pfNo" VARCHAR,
    "tanNo" VARCHAR,
    "esiNo" VARCHAR,
    "linNo" VARCHAR,
    "gstNo" VARCHAR,
    "shopRegNo" VARCHAR,
    "financialYearStart" VARCHAR,
    "contactNo" VARCHAR,
    "emailAdd" VARCHAR,
    "companyLogoUrl" VARCHAR,
    "SignatureUrl" VARCHAR,

    CONSTRAINT "Contractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Departments" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "departmentName" VARCHAR,

    CONSTRAINT "Departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Designations" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "designation" VARCHAR,

    CONSTRAINT "Designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Devices" (
    "id" SERIAL NOT NULL,
    "status" "public"."DeviceStatus" NOT NULL DEFAULT 'Active',
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "deviceName" VARCHAR NOT NULL,
    "deviceMake" VARCHAR NOT NULL,
    "deviceModel" VARCHAR NOT NULL,
    "deviceSN" VARCHAR NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendanceLogs" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "deviceSN" VARCHAR NOT NULL,
    "userId" VARCHAR NOT NULL,
    "logTime" VARCHAR NOT NULL,
    "status" VARCHAR NOT NULL DEFAULT '0',
    "workCode" VARCHAR NOT NULL DEFAULT '0',
    "rawData" TEXT NOT NULL,
    "processed" VARCHAR NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpAttendanceRegularise" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "manageEmployeeID" INTEGER,
    "attendanceDate" DATE,
    "day" TEXT,
    "checkInTime" TIMESTAMP(6),
    "checkOutTime" TIMESTAMP(6),
    "remarks" VARCHAR,
    "status" VARCHAR DEFAULT 'Pending',

    CONSTRAINT "EmpAttendanceRegularise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpCurrentPosition" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "manageEmployeeID" INTEGER,
    "existingDepartmentID" INTEGER,
    "existingDesignationID" INTEGER,
    "existingMonthlyPayGradeID" INTEGER,
    "existingHourlyPayGradeID" INTEGER,
    "existingSalaryCtc" INTEGER,
    "existingEmploymentType" INTEGER,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(6),

    CONSTRAINT "EmpCurrentPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromotionRequest" (
    "id" SERIAL NOT NULL,
    "manageEmployeeID" INTEGER,
    "empID" VARCHAR,
    "newDepartmentID" INTEGER,
    "newDesignationID" INTEGER,
    "newMonthlyPayGradeID" INTEGER,
    "newHourlyPayGradeID" INTEGER,
    "newSalaryCtc" INTEGER,
    "newEmploymentType" INTEGER,
    "newEmployementStatus" VARCHAR,
    "proposedDepartmentID" INTEGER,
    "proposedDesignationID" INTEGER,
    "proposedMonthlyPayGradeID" INTEGER,
    "proposedHourlyPayGradeID" INTEGER,
    "proposedSalaryCtc" INTEGER,
    "proposedEmploymentType" INTEGER,
    "description" VARCHAR,
    "promotionDate" DATE,
    "status" VARCHAR,
    "applied_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "PromotionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpAttendanceLogs" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER NOT NULL,
    "companyID" INTEGER NOT NULL,
    "branchesID" INTEGER NOT NULL,
    "deviceID" INTEGER NOT NULL,
    "employeeID" INTEGER,
    "punchTimeStamp" VARCHAR NOT NULL,
    "latitude" INTEGER,
    "longitude" INTEGER,
    "googleMapLink" INTEGER,
    "location" INTEGER,
    "mobileDeviceID" INTEGER,
    "mobileDeviceInfo" INTEGER,
    "exported" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpAttendanceLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpFieldSiteAttendance" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "manageEmployeeID" INTEGER,
    "siteName" VARCHAR,
    "address" VARCHAR,
    "latitude" VARCHAR,
    "longitude" VARCHAR,
    "fromDate" DATE,
    "toDate" DATE,

    CONSTRAINT "EmpFieldSiteAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GenarateBonus" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "manageEmployeeID" INTEGER,
    "bonusSetupID" INTEGER,
    "financialYear" INTEGER,
    "salaryPeriod" INTEGER,

    CONSTRAINT "GenarateBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HourlyPayGrade" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "hourlyPayGradeName" VARCHAR,
    "hourlyRate" VARCHAR,

    CONSTRAINT "HourlyPayGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leaveApplication" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "manageEmployeeID" INTEGER,
    "remainingSickLeave" INTEGER,
    "remainingCasualLeave" INTEGER,
    "remainingEarnedLeave" INTEGER,
    "appliedLeaveType" VARCHAR,
    "fromDate" DATE,
    "toDate" DATE,
    "purpose" VARCHAR,
    "status" VARCHAR DEFAULT 'Pending',

    CONSTRAINT "leaveApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leaveApplicationRequest" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "leaveApplicationID" INTEGER,
    "leaveApplicationStatus" VARCHAR,

    CONSTRAINT "leaveApplicationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leavePolicy" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "leavePolicyName" VARCHAR,
    "sickLeaveCount" VARCHAR,
    "casualLeaveCount" VARCHAR,
    "earnLeaveWorkingMonths" VARCHAR,
    "earnLeaveCount" INTEGER,

    CONSTRAINT "leavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leavePolicyHoliday" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "leavePolicyID" INTEGER,
    "publicHolidayID" INTEGER,

    CONSTRAINT "leavePolicyHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ManageEmployee" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "employeeFirstName" VARCHAR,
    "employeeLastName" VARCHAR,
    "employeeID" VARCHAR,
    "joiningDate" VARCHAR,
    "contractorID" INTEGER,
    "businessPhoneNo" VARCHAR,
    "businessEmail" VARCHAR,
    "personalPhoneNo" VARCHAR,
    "personalEmail" VARCHAR,
    "emergancyContact" VARCHAR,
    "presentAddress" VARCHAR,
    "permenantAddress" VARCHAR,
    "employeePhotoUrl" VARCHAR,
    "gender" VARCHAR,
    "dateOfBirth" VARCHAR,
    "bloodGroup" VARCHAR,
    "maritalStatus" VARCHAR,
    "employeeFatherName" VARCHAR,
    "employeeMotherName" VARCHAR,
    "employeeSpouseName" VARCHAR,
    "departmentNameID" INTEGER,
    "designationID" INTEGER,
    "managerID" INTEGER,
    "employmentType" VARCHAR,
    "employmentStatus" VARCHAR,
    "probationPeriod" VARCHAR,
    "workShiftID" INTEGER,
    "attendancePolicyID" INTEGER,
    "leavePolicyID" INTEGER,
    "salaryPayGradeType" VARCHAR,
    "monthlyPayGradeID" INTEGER,
    "hourlyPayGradeID" INTEGER,

    CONSTRAINT "ManageEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpPromotion" (
    "id" SERIAL NOT NULL,
    "manageEmployeeID" INTEGER NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "departmentNameID" INTEGER,
    "designationID" INTEGER,
    "managerID" INTEGER,
    "employmentType" VARCHAR,
    "employmentStatus" VARCHAR,
    "probationPeriod" VARCHAR,
    "workShiftID" INTEGER,
    "attendancePolicyID" INTEGER,
    "leavePolicyID" INTEGER,
    "salaryPayGradeType" VARCHAR,
    "monthlyPayGradeID" INTEGER,
    "hourlyPayGradeID" INTEGER,
    "promotedSalaryCtc" INTEGER,
    "description" VARCHAR,
    "promotionDate" DATE,
    "status" VARCHAR,

    CONSTRAINT "EmpPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpEduQualification" (
    "id" SERIAL NOT NULL,
    "manageEmployeeID" INTEGER,
    "instituteType" VARCHAR,
    "instituteName" VARCHAR,
    "degree" VARCHAR,
    "pasingYear" VARCHAR,
    "marks" VARCHAR,
    "gpaCgpa" VARCHAR,
    "class" VARCHAR,

    CONSTRAINT "EmpEduQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpProfExprience" (
    "id" SERIAL NOT NULL,
    "manageEmployeeID" INTEGER,
    "orgName" VARCHAR,
    "designation" VARCHAR,
    "fromDate" VARCHAR,
    "toDate" VARCHAR,
    "responsibility" VARCHAR,
    "skill" VARCHAR,

    CONSTRAINT "EmpProfExprience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpDeviceMapping" (
    "id" SERIAL NOT NULL,
    "manageEmployeeID" INTEGER,
    "deviceID" INTEGER NOT NULL,
    "deviceEmpCode" VARCHAR,

    CONSTRAINT "EmpDeviceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ManageHoliday" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "holidayName" VARCHAR,

    CONSTRAINT "ManageHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MonthlyPayGrade" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "monthlyPayGradeName" VARCHAR,
    "salType" VARCHAR,
    "grossSalary" VARCHAR,
    "percentageOfBasic" VARCHAR,
    "basicSalary" INTEGER,

    CONSTRAINT "MonthlyPayGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MonthlyPayGradeAllowanceList" (
    "id" SERIAL NOT NULL,
    "monthlyPayGradeID" INTEGER,
    "salaryallowanceID" INTEGER,

    CONSTRAINT "MonthlyPayGradeAllowanceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MonthlyPayGradeDeductionList" (
    "id" SERIAL NOT NULL,
    "salaryDeductionID" INTEGER,
    "monthlyPayGradeID" INTEGER,

    CONSTRAINT "MonthlyPayGradeDeductionList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PublicHoliday" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "manageHolidayID" INTEGER,
    "financialYear" VARCHAR,
    "startDate" DATE,
    "endDate" DATE,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalaryAllowance" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "salaryAllowanceName" VARCHAR,
    "salaryAllowanceType" VARCHAR,
    "salaryAllowanceValue" VARCHAR,
    "salaryAllowanceMonthLimit" VARCHAR,

    CONSTRAINT "SalaryAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalaryCycle" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "salaryCycleName" VARCHAR,
    "monthStartDay" VARCHAR,

    CONSTRAINT "SalaryCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GenerateSalary" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "employeeID" INTEGER NOT NULL,
    "monthPeriod" TEXT NOT NULL,
    "markAs" TEXT,
    "lateMarkCount" TEXT,

    CONSTRAINT "GenerateSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalaryDeduction" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "salaryDeductionName" VARCHAR,
    "salaryDeductionType" VARCHAR,
    "salaryDeductionValue" VARCHAR,
    "salaryDeductionMonthLimit" VARCHAR,

    CONSTRAINT "SalaryDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkShift" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "workShiftName" VARCHAR,
    "isActive" VARCHAR,

    CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkShiftDay" (
    "id" SERIAL NOT NULL,
    "workShiftID" INTEGER,
    "weekDay" VARCHAR,
    "weeklyOff" BOOLEAN,
    "startTime" TEXT,
    "endTime" TEXT,
    "totalMinutes" INTEGER,

    CONSTRAINT "WorkShiftDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CalendarDay" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "isoDate" TIMESTAMP(3) NOT NULL,
    "weekday" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Holiday" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "region" TEXT,
    "type" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HolidayOnDay" (
    "id" SERIAL NOT NULL,
    "calendarDayId" INTEGER NOT NULL,
    "holidayId" INTEGER NOT NULL,

    CONSTRAINT "HolidayOnDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalaryAdvance" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "manageEmployeeID" INTEGER,
    "previousAdvancesDue" TEXT,
    "advanceAmount" TEXT,
    "reason" TEXT,
    "status" TEXT DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalaryAdvanceRepayment" (
    "id" SERIAL NOT NULL,
    "salaryAdvanceID" INTEGER NOT NULL,
    "approvedAmount" TEXT NOT NULL,
    "startMonth" TIMESTAMP(3),
    "amount" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryAdvanceRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reimbursement" (
    "id" SERIAL NOT NULL,
    "serviceProviderID" INTEGER,
    "companyID" INTEGER,
    "branchesID" INTEGER,
    "manageEmployeeID" INTEGER,
    "date" TEXT,
    "reimbursementType" TEXT,
    "amount" TEXT,
    "description" TEXT,
    "status" TEXT DEFAULT 'Pending',
    "approvalType" TEXT,
    "salaryPeriod" TEXT,
    "voucherCode" TEXT,
    "voucherDate" TEXT,

    CONSTRAINT "Reimbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReimbursementItem" (
    "id" SERIAL NOT NULL,
    "reimbursementID" INTEGER NOT NULL,
    "reimbursementType" TEXT,
    "amount" TEXT,
    "description" TEXT,

    CONSTRAINT "ReimbursementItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankDetails_branchesID_idx" ON "public"."BankDetails"("branchesID");

-- CreateIndex
CREATE UNIQUE INDEX "Devices_deviceSN_key" ON "public"."Devices"("deviceSN");

-- CreateIndex
CREATE INDEX "EmpPromotion_manageEmployeeID_idx" ON "public"."EmpPromotion"("manageEmployeeID");

-- CreateIndex
CREATE INDEX "EmpEduQualification_manageEmployeeID_idx" ON "public"."EmpEduQualification"("manageEmployeeID");

-- CreateIndex
CREATE INDEX "EmpProfExprience_manageEmployeeID_idx" ON "public"."EmpProfExprience"("manageEmployeeID");

-- CreateIndex
CREATE INDEX "EmpDeviceMapping_manageEmployeeID_idx" ON "public"."EmpDeviceMapping"("manageEmployeeID");

-- CreateIndex
CREATE INDEX "EmpDeviceMapping_deviceID_idx" ON "public"."EmpDeviceMapping"("deviceID");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDay_isoDate_key" ON "public"."CalendarDay"("isoDate");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_slug_key" ON "public"."Holiday"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayOnDay_calendarDayId_holidayId_key" ON "public"."HolidayOnDay"("calendarDayId", "holidayId");

-- AddForeignKey
ALTER TABLE "public"."AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."BankDetails" ADD CONSTRAINT "BankDetails_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."BankDetails" ADD CONSTRAINT "BankDetails_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."BankDetails" ADD CONSTRAINT "BankDetails_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."BonusSetup" ADD CONSTRAINT "BonusSetup_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."BonusSetup" ADD CONSTRAINT "BonusSetup_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."BonusSetup" ADD CONSTRAINT "BonusSetup_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."BonusAllocation" ADD CONSTRAINT "BonusAllocation_bonusSetupID_fkey" FOREIGN KEY ("bonusSetupID") REFERENCES "public"."BonusSetup"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."BonusAllocation" ADD CONSTRAINT "BonusAllocation_employeeID_fkey" FOREIGN KEY ("employeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Branches" ADD CONSTRAINT "Branches_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Branches" ADD CONSTRAINT "Branches_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Contractors" ADD CONSTRAINT "Contractors_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Contractors" ADD CONSTRAINT "Contractors_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Contractors" ADD CONSTRAINT "Contractors_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Departments" ADD CONSTRAINT "Departments_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Departments" ADD CONSTRAINT "Departments_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Departments" ADD CONSTRAINT "Departments_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Designations" ADD CONSTRAINT "Designations_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Designations" ADD CONSTRAINT "Designations_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Designations" ADD CONSTRAINT "Designations_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Devices" ADD CONSTRAINT "Devices_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Devices" ADD CONSTRAINT "Devices_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Devices" ADD CONSTRAINT "Devices_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."AttendanceLogs" ADD CONSTRAINT "AttendanceLogs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpAttendanceRegularise" ADD CONSTRAINT "EmpAttendanceRegularise_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpAttendanceRegularise" ADD CONSTRAINT "EmpAttendanceRegularise_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpAttendanceRegularise" ADD CONSTRAINT "EmpAttendanceRegularise_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpAttendanceRegularise" ADD CONSTRAINT "EmpAttendanceRegularise_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpCurrentPosition" ADD CONSTRAINT "EmpCurrentPosition_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpCurrentPosition" ADD CONSTRAINT "EmpCurrentPosition_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpCurrentPosition" ADD CONSTRAINT "EmpCurrentPosition_existingDepartmentID_fkey" FOREIGN KEY ("existingDepartmentID") REFERENCES "public"."Departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpCurrentPosition" ADD CONSTRAINT "EmpCurrentPosition_existingDesignationID_fkey" FOREIGN KEY ("existingDesignationID") REFERENCES "public"."Designations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpCurrentPosition" ADD CONSTRAINT "EmpCurrentPosition_existingHourlyPayGradeID_fkey" FOREIGN KEY ("existingHourlyPayGradeID") REFERENCES "public"."HourlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpCurrentPosition" ADD CONSTRAINT "EmpCurrentPosition_existingMonthlyPayGradeID_fkey" FOREIGN KEY ("existingMonthlyPayGradeID") REFERENCES "public"."MonthlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpCurrentPosition" ADD CONSTRAINT "EmpCurrentPosition_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpCurrentPosition" ADD CONSTRAINT "EmpCurrentPosition_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PromotionRequest" ADD CONSTRAINT "PromotionRequest_newDepartmentID_fkey" FOREIGN KEY ("newDepartmentID") REFERENCES "public"."Departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PromotionRequest" ADD CONSTRAINT "PromotionRequest_newDesignationID_fkey" FOREIGN KEY ("newDesignationID") REFERENCES "public"."Designations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PromotionRequest" ADD CONSTRAINT "PromotionRequest_newHourlyPayGradeID_fkey" FOREIGN KEY ("newHourlyPayGradeID") REFERENCES "public"."HourlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PromotionRequest" ADD CONSTRAINT "PromotionRequest_newMonthlyPayGradeID_fkey" FOREIGN KEY ("newMonthlyPayGradeID") REFERENCES "public"."MonthlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PromotionRequest" ADD CONSTRAINT "PromotionRequest_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PromotionRequest" ADD CONSTRAINT "PromotionRequest_proposedDepartmentID_fkey" FOREIGN KEY ("proposedDepartmentID") REFERENCES "public"."Departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PromotionRequest" ADD CONSTRAINT "PromotionRequest_proposedDesignationID_fkey" FOREIGN KEY ("proposedDesignationID") REFERENCES "public"."Designations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PromotionRequest" ADD CONSTRAINT "PromotionRequest_proposedHourlyPayGradeID_fkey" FOREIGN KEY ("proposedHourlyPayGradeID") REFERENCES "public"."HourlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PromotionRequest" ADD CONSTRAINT "PromotionRequest_proposedMonthlyPayGradeID_fkey" FOREIGN KEY ("proposedMonthlyPayGradeID") REFERENCES "public"."MonthlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpFieldSiteAttendance" ADD CONSTRAINT "EmpFieldSiteAttendance_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpFieldSiteAttendance" ADD CONSTRAINT "EmpFieldSiteAttendance_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpFieldSiteAttendance" ADD CONSTRAINT "EmpFieldSiteAttendance_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpFieldSiteAttendance" ADD CONSTRAINT "EmpFieldSiteAttendance_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."GenarateBonus" ADD CONSTRAINT "GenarateBonus_bonusSetupID_fkey" FOREIGN KEY ("bonusSetupID") REFERENCES "public"."BonusSetup"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."GenarateBonus" ADD CONSTRAINT "GenarateBonus_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."GenarateBonus" ADD CONSTRAINT "GenarateBonus_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."GenarateBonus" ADD CONSTRAINT "GenarateBonus_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."leaveApplication"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."GenarateBonus" ADD CONSTRAINT "GenarateBonus_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."HourlyPayGrade" ADD CONSTRAINT "HourlyPayGrade_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."HourlyPayGrade" ADD CONSTRAINT "HourlyPayGrade_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."HourlyPayGrade" ADD CONSTRAINT "HourlyPayGrade_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leaveApplication" ADD CONSTRAINT "leaveApplication_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leaveApplication" ADD CONSTRAINT "leaveApplication_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leaveApplication" ADD CONSTRAINT "leaveApplication_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leaveApplication" ADD CONSTRAINT "leaveApplication_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leaveApplicationRequest" ADD CONSTRAINT "leaveApplicationRequest_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leaveApplicationRequest" ADD CONSTRAINT "leaveApplicationRequest_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leaveApplicationRequest" ADD CONSTRAINT "leaveApplicationRequest_leaveApplicationID_fkey" FOREIGN KEY ("leaveApplicationID") REFERENCES "public"."leaveApplication"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leaveApplicationRequest" ADD CONSTRAINT "leaveApplicationRequest_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leavePolicy" ADD CONSTRAINT "leavePolicy_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leavePolicy" ADD CONSTRAINT "leavePolicy_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leavePolicy" ADD CONSTRAINT "leavePolicy_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leavePolicyHoliday" ADD CONSTRAINT "leavePolicyHoliday_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leavePolicyHoliday" ADD CONSTRAINT "leavePolicyHoliday_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leavePolicyHoliday" ADD CONSTRAINT "leavePolicyHoliday_leavePolicyID_fkey" FOREIGN KEY ("leavePolicyID") REFERENCES "public"."leavePolicy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leavePolicyHoliday" ADD CONSTRAINT "leavePolicyHoliday_publicHolidayID_fkey" FOREIGN KEY ("publicHolidayID") REFERENCES "public"."PublicHoliday"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leavePolicyHoliday" ADD CONSTRAINT "leavePolicyHoliday_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_contractorID_fkey" FOREIGN KEY ("contractorID") REFERENCES "public"."Contractors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_departmentNameID_fkey" FOREIGN KEY ("departmentNameID") REFERENCES "public"."Departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_designationID_fkey" FOREIGN KEY ("designationID") REFERENCES "public"."Designations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_managerID_fkey" FOREIGN KEY ("managerID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_workShiftID_fkey" FOREIGN KEY ("workShiftID") REFERENCES "public"."WorkShift"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_attendancePolicyID_fkey" FOREIGN KEY ("attendancePolicyID") REFERENCES "public"."AttendancePolicy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_leavePolicyID_fkey" FOREIGN KEY ("leavePolicyID") REFERENCES "public"."leavePolicy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_monthlyPayGradeID_fkey" FOREIGN KEY ("monthlyPayGradeID") REFERENCES "public"."MonthlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageEmployee" ADD CONSTRAINT "ManageEmployee_hourlyPayGradeID_fkey" FOREIGN KEY ("hourlyPayGradeID") REFERENCES "public"."HourlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_departmentNameID_fkey" FOREIGN KEY ("departmentNameID") REFERENCES "public"."Departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_designationID_fkey" FOREIGN KEY ("designationID") REFERENCES "public"."Designations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_workShiftID_fkey" FOREIGN KEY ("workShiftID") REFERENCES "public"."WorkShift"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_attendancePolicyID_fkey" FOREIGN KEY ("attendancePolicyID") REFERENCES "public"."AttendancePolicy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_leavePolicyID_fkey" FOREIGN KEY ("leavePolicyID") REFERENCES "public"."leavePolicy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_hourlyPayGradeID_fkey" FOREIGN KEY ("hourlyPayGradeID") REFERENCES "public"."HourlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_monthlyPayGradeID_fkey" FOREIGN KEY ("monthlyPayGradeID") REFERENCES "public"."MonthlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpPromotion" ADD CONSTRAINT "EmpPromotion_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpEduQualification" ADD CONSTRAINT "EmpEduQualification_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpProfExprience" ADD CONSTRAINT "EmpProfExprience_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpDeviceMapping" ADD CONSTRAINT "EmpDeviceMapping_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."EmpDeviceMapping" ADD CONSTRAINT "EmpDeviceMapping_deviceID_fkey" FOREIGN KEY ("deviceID") REFERENCES "public"."Devices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageHoliday" ADD CONSTRAINT "ManageHoliday_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageHoliday" ADD CONSTRAINT "ManageHoliday_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ManageHoliday" ADD CONSTRAINT "ManageHoliday_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."MonthlyPayGrade" ADD CONSTRAINT "MonthlyPayGrade_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."MonthlyPayGrade" ADD CONSTRAINT "MonthlyPayGrade_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."MonthlyPayGrade" ADD CONSTRAINT "MonthlyPayGrade_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."MonthlyPayGradeAllowanceList" ADD CONSTRAINT "MonthlyPayGradeAllowanceList_monthlyPayGradeID_fkey" FOREIGN KEY ("monthlyPayGradeID") REFERENCES "public"."MonthlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."MonthlyPayGradeAllowanceList" ADD CONSTRAINT "MonthlyPayGradeAllowanceList_salaryallowanceID_fkey" FOREIGN KEY ("salaryallowanceID") REFERENCES "public"."SalaryAllowance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."MonthlyPayGradeDeductionList" ADD CONSTRAINT "MonthlyPayGradeDeductionList_monthlyPayGradeID_fkey" FOREIGN KEY ("monthlyPayGradeID") REFERENCES "public"."MonthlyPayGrade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."MonthlyPayGradeDeductionList" ADD CONSTRAINT "MonthlyPayGradeDeductionList_salaryDeductionID_fkey" FOREIGN KEY ("salaryDeductionID") REFERENCES "public"."SalaryDeduction"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PublicHoliday" ADD CONSTRAINT "PublicHoliday_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PublicHoliday" ADD CONSTRAINT "PublicHoliday_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PublicHoliday" ADD CONSTRAINT "PublicHoliday_manageHolidayID_fkey" FOREIGN KEY ("manageHolidayID") REFERENCES "public"."ManageHoliday"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PublicHoliday" ADD CONSTRAINT "PublicHoliday_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryAllowance" ADD CONSTRAINT "SalaryAllowance_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryAllowance" ADD CONSTRAINT "SalaryAllowance_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryAllowance" ADD CONSTRAINT "SalaryAllowance_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryCycle" ADD CONSTRAINT "SalaryCycle_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryCycle" ADD CONSTRAINT "SalaryCycle_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryCycle" ADD CONSTRAINT "SalaryCycle_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."GenerateSalary" ADD CONSTRAINT "GenerateSalary_employeeID_fkey" FOREIGN KEY ("employeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."GenerateSalary" ADD CONSTRAINT "GenerateSalary_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."GenerateSalary" ADD CONSTRAINT "GenerateSalary_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."GenerateSalary" ADD CONSTRAINT "GenerateSalary_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryDeduction" ADD CONSTRAINT "SalaryDeduction_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryDeduction" ADD CONSTRAINT "SalaryDeduction_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryDeduction" ADD CONSTRAINT "SalaryDeduction_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."WorkShift" ADD CONSTRAINT "WorkShift_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."WorkShift" ADD CONSTRAINT "WorkShift_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."WorkShift" ADD CONSTRAINT "WorkShift_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."WorkShiftDay" ADD CONSTRAINT "WorkShiftDay_workShiftID_fkey" FOREIGN KEY ("workShiftID") REFERENCES "public"."WorkShift"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."HolidayOnDay" ADD CONSTRAINT "HolidayOnDay_calendarDayId_fkey" FOREIGN KEY ("calendarDayId") REFERENCES "public"."CalendarDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HolidayOnDay" ADD CONSTRAINT "HolidayOnDay_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "public"."Holiday"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."SalaryAdvanceRepayment" ADD CONSTRAINT "SalaryAdvanceRepayment_salaryAdvanceID_fkey" FOREIGN KEY ("salaryAdvanceID") REFERENCES "public"."SalaryAdvance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reimbursement" ADD CONSTRAINT "Reimbursement_branchesID_fkey" FOREIGN KEY ("branchesID") REFERENCES "public"."Branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Reimbursement" ADD CONSTRAINT "Reimbursement_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "public"."Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Reimbursement" ADD CONSTRAINT "Reimbursement_manageEmployeeID_fkey" FOREIGN KEY ("manageEmployeeID") REFERENCES "public"."ManageEmployee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Reimbursement" ADD CONSTRAINT "Reimbursement_serviceProviderID_fkey" FOREIGN KEY ("serviceProviderID") REFERENCES "public"."ServiceProvider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ReimbursementItem" ADD CONSTRAINT "ReimbursementItem_reimbursementID_fkey" FOREIGN KEY ("reimbursementID") REFERENCES "public"."Reimbursement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
