export class CreateReimbursementDto {
  serviceProviderID?: number;
  companyID?: number;
  branchesID?: number;
  manageEmployeeID?: number;
  taskProjectID?: number;
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
  id?: number;
  reimbursementType?: string;
  amount?: string;
  description?: string;
  status?: string;
  approvalType?: string;
  paidStatus?: string;
  paymentRemark?: string;
}