/**
 * One-off: remove the ENPL demo employee "Test Test" (employeeID test001).
 * Does not change the Manage Employee delete API.
 *
 *   cd backend && npx ts-node -r dotenv/config scripts/remove-enpl-demo-test-employee.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TARGET_ID = 54;
const TARGET_CODE = 'test001';
const TARGET_COMPANY_ID = 2;

async function main() {
  const employee = await prisma.manageEmployee.findFirst({
    where: {
      id: TARGET_ID,
      employeeID: { equals: TARGET_CODE, mode: 'insensitive' },
      companyID: TARGET_COMPANY_ID,
      employeeFirstName: { equals: 'Test', mode: 'insensitive' },
      employeeLastName: { equals: 'Test', mode: 'insensitive' },
    },
    select: { id: true, employeeID: true, businessEmail: true, companyID: true },
  });

  if (!employee) {
    console.log('ENPL demo employee Test Test (test001) is not present. Nothing to remove.');
    return;
  }

  const id = employee.id;
  await prisma.$transaction(async (tx) => {
    await tx.reimbursementItem.deleteMany({
      where: { reimbursement: { manageEmployeeID: id } },
    });
    await tx.reimbursement.deleteMany({ where: { manageEmployeeID: id } });
    await tx.employeeTermination.deleteMany({ where: { employeeId: id } });
    await tx.attendanceLocation.deleteMany({ where: { employeeId: id } });
    await tx.taskAssignment.deleteMany({ where: { manageEmployeeID: id } });
    await tx.taskEngineerAssignment.deleteMany({ where: { manageEmployeeID: id } });
    await tx.taskProject.updateMany({
      where: { createdByEmployeeID: id },
      data: { createdByEmployeeID: null },
    });
    await tx.employeeCredentials.deleteMany({ where: { employeeID: id } });
    await tx.empDeviceMapping.deleteMany({ where: { manageEmployeeID: id } });
    await tx.tokenDeviceMapping.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empProfExprience.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empEduQualification.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empDesignation.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empBranch.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empDepartment.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empEmploymentType.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empEmploymentStatus.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empWorkShift.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empAttendancePolicy.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empFactualWorkShift.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empFactualAttendancePolicy.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empLeavePolicy.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empContractor.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empCurrentPosition.deleteMany({ where: { manageEmployeeID: id } });
    await tx.promotionRequest.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empPromotion.deleteMany({ where: { manageEmployeeID: id } });
    await tx.employeeBankDetails.deleteMany({ where: { employeeID: id } });
    await tx.employeeDocument.deleteMany({ where: { employeeID: id } });
    await tx.empAttendanceRegularise.deleteMany({ where: { manageEmployeeID: id } });
    await tx.empFieldSiteAttendance.deleteMany({ where: { manageEmployeeID: id } });
    await tx.genarateBonus.deleteMany({ where: { manageEmployeeID: id } });
    await tx.leaveApplication.deleteMany({ where: { manageEmployeeID: id } });
    await tx.bonusAllocation.deleteMany({ where: { employeeID: id } });
    await tx.employeeFieldHistory.deleteMany({ where: { employeeId: id } });
    await tx.employeeLink.deleteMany({
      where: { OR: [{ employeeId: id }, { linkedEmployeeId: id }] },
    });
    await tx.employeeMemo.deleteMany({ where: { employeeID: id } });
    await tx.employeeModulePermission.deleteMany({ where: { manageEmployeeID: id } });
    await tx.manageEmployee.delete({ where: { id } });
  });

  console.log(
    `Removed ENPL demo employee ${employee.employeeID} (id ${id}, ${employee.businessEmail}).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
