-- CreateTable: EmpFactualWorkShift
CREATE TABLE IF NOT EXISTS "EmpFactualWorkShift" (
    "id" SERIAL NOT NULL,
    "manageEmployeeID" INTEGER NOT NULL,
    "factualWorkShiftID" INTEGER NOT NULL,
    "effectFrom" VARCHAR,
    CONSTRAINT "EmpFactualWorkShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmpFactualWorkShift_manageEmployeeID_idx" ON "EmpFactualWorkShift"("manageEmployeeID");

-- AddForeignKey
ALTER TABLE "EmpFactualWorkShift" ADD CONSTRAINT "EmpFactualWorkShift_manageEmployeeID_fkey"
    FOREIGN KEY ("manageEmployeeID") REFERENCES "ManageEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmpFactualWorkShift" ADD CONSTRAINT "EmpFactualWorkShift_factualWorkShiftID_fkey"
    FOREIGN KEY ("factualWorkShiftID") REFERENCES "FactualWorkShift"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateTable: EmpFactualAttendancePolicy
CREATE TABLE IF NOT EXISTS "EmpFactualAttendancePolicy" (
    "id" SERIAL NOT NULL,
    "manageEmployeeID" INTEGER NOT NULL,
    "factualAttendancePolicyID" INTEGER NOT NULL,
    "effectFrom" VARCHAR,
    CONSTRAINT "EmpFactualAttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmpFactualAttendancePolicy_manageEmployeeID_idx" ON "EmpFactualAttendancePolicy"("manageEmployeeID");

-- AddForeignKey
ALTER TABLE "EmpFactualAttendancePolicy" ADD CONSTRAINT "EmpFactualAttendancePolicy_manageEmployeeID_fkey"
    FOREIGN KEY ("manageEmployeeID") REFERENCES "ManageEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmpFactualAttendancePolicy" ADD CONSTRAINT "EmpFactualAttendancePolicy_factualAttendancePolicyID_fkey"
    FOREIGN KEY ("factualAttendancePolicyID") REFERENCES "FactualAttendancePolicy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
