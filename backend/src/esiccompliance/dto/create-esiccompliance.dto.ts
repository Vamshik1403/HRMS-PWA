export class CreateESICComplianceDto {
  companyID: number;
  esicThresholdCount?: number;
  esicApplicable?: boolean;
  wageCeiling?: number;
  disabledWageCeiling?: number;
  employeeRate?: number;
  employerRate?: number;
  dueDate?: number;
}