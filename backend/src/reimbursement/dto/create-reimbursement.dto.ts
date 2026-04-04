export class CreateReimbursementDto {
  serviceProviderID?: number;
  companyID?: number;
  branchesID?: number;
  manageEmployeeID?: number;
  date?: string;
  status?: string;
  
  // Approval fields
  approvalType?: string;
  salaryPeriod?: string;
  voucherCode?: string;
  voucherDate?: string;
  
  // Payment fields (NEW)
  paymentMode?: string;
  paymentType?: string;
  paymentDate?: string;
  paymentRemark?: string;
  paymentProof?: string;
  
  items?: ReimbursementItemDto[];
}

export class ReimbursementItemDto {
  reimbursementType?: string;
  amount?: string;
  description?: string;
}