export class PTSlabDto {
  slabName?: string;
  monthlyGrossFrom?: number;
  monthlyGrossTo?: number;
  amount?: number;
  applicableMonths?: number[]; // Array of month numbers (1-12)
}

export class CreatePTComplianceDto {
  companyID: number;
  branchID: number;
  ptApplicable?: boolean;
  state?: string;
  maxPTPersonPerYear?: number;
  monthlyDueDate?: number;
  quarterlyDueDate?: number;
  monthlyReturnThreshold?: number;
  quarterlyReturnThreshold?: number;
  ptslab?: PTSlabDto[];
}