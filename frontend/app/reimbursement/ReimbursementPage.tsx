"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle,
} from "../components/ui/dialog"  
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Search, Edit, Trash2, Check, X, Plus, PlusCircle, MinusCircle, Settings, Download, CreditCard, User, Building, MapPin, Calendar, Loader2 } from "lucide-react"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { toast } from "sonner"


interface ReimbursementItem {
  id?: number
  reimbursementType: string
  amount: string
  description: string
}

interface EmployeeBankDetails {
  id: number
  employeeID: number
  bankName: string
  bankBranchName: string
  accNumber: string
  ifscCode: string
  upi: string
}

interface Reimbursement {
  id: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  manageEmployeeID?: number
  serviceProvider?: string
  companyName?: string
  branchName?: string
  employeeName?: string
  date: string
  // Header-level fields (for backward compatibility)
  reimbursementType?: string
  amount?: string
  description?: string
  status: string
  // New approval system fields
  approvalType?: string
  salaryPeriod?: string
  voucherCode?: string
  voucherDate?: string
  items?: ReimbursementItem[]
  // Payment fields
  paymentMode?: string
  paymentType?: string
  paymentDate?: string
  paymentRemark?: string
  paymentProof?: string
}

interface ReimbursementFormData {
  serviceProvider: string
  companyName: string
  branchName: string
  employeeName: string
  date: string
  status: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  manageEmployeeID?: number
  serviceProviderName?: string // Add this
}

interface SelectedItem {
  display: string
  value: number
  item: any
}

interface Company {
  id: number
  companyName: string
  financialYearStart: string
}

interface SalaryCycle {
  id: number
  monthStartDay: string
  companyID: number
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"

// ---------- Financial Year and Salary Period Logic ----------
const monthsFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function clampDay(d: number) {
  if (!Number.isFinite(d)) return 1;
  return Math.max(1, Math.min(28, Math.floor(d)));
}

function buildSalaryPeriodLabels(fyStart?: string | null, dayStr?: string | number | null): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const day = clampDay(Number(dayStr ?? 1));
  const fyIsJan = (fyStart ?? "").trim().toLowerCase() === "1st jan";
  const fyIsApr = (fyStart ?? "").trim().toLowerCase() === "1st april";

  const addMonths = (y: number, m: number, delta: number) => {
    const n = m + delta;
    const y2 = y + Math.floor(n / 12);
    const m2 = ((n % 12) + 12) % 12;
    return { y: y2, m: m2 };
  };

  const makeDate = (y: number, m: number, d: number) => new Date(y, m, d);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")} ${monthsFull[d.getMonth()]} ${d.getFullYear()}`;

  if (day === 1) {
    if (fyIsJan) {
      return Array.from({ length: 12 }).map((_, i) => `${monthsFull[i]} ${currentYear}`);
    }
    const out: string[] = [];
    for (let i = 3; i <= 11; i++) out.push(`${monthsFull[i]} ${currentYear}`);
    out.push(`January ${currentYear + 1}`, `February ${currentYear + 1}`, `March ${currentYear + 1}`);
    return out;
  }

  const periods: string[] = [];

  if (fyIsJan) {
    const start0 = makeDate(currentYear - 1, 11, day);
    for (let i = 0; i < 12; i++) {
      const start = addMonths(start0.getFullYear(), start0.getMonth(), i);
      const startDate = makeDate(start.y, start.m, day);
      const end = addMonths(startDate.getFullYear(), startDate.getMonth(), 1);
      const endDate = makeDate(end.y, end.m, day - 1);
      periods.push(`${fmt(startDate)} to ${fmt(endDate)}`);
    }
    return periods;
  }

  const start0 = makeDate(currentYear, 2, day); // March
  for (let i = 0; i < 12; i++) {
    const start = addMonths(start0.getFullYear(), start0.getMonth(), i);
    const startDate = makeDate(start.y, start.m, day);
    const end = addMonths(startDate.getFullYear(), startDate.getMonth(), 1);
    const endDate = makeDate(end.y, end.m, day - 1);
    periods.push(`${fmt(startDate)} to ${fmt(endDate)}`);
  }
  return periods;
}

// Helper function for amount in words
const convertNumberToWords = (num: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  
  let words = '';
  
  // Handle rupees part
  let rupees = Math.floor(num);
  
  if (rupees >= 10000000) {
    words += convertNumberToWords(Math.floor(rupees / 10000000)) + ' Crore ';
    rupees %= 10000000;
  }
  
  if (rupees >= 100000) {
    words += convertNumberToWords(Math.floor(rupees / 100000)) + ' Lakh ';
    rupees %= 100000;
  }
  
  if (rupees >= 1000) {
    words += convertNumberToWords(Math.floor(rupees / 1000)) + ' Thousand ';
    rupees %= 1000;
  }
  
  if (rupees >= 100) {
    words += convertNumberToWords(Math.floor(rupees / 100)) + ' Hundred ';
    rupees %= 100;
  }
  
  if (rupees > 0) {
    if (words !== '') words += 'and ';
    
    if (rupees < 20) {
      words += ones[rupees];
    } else {
      words += tens[Math.floor(rupees / 10)];
      if (rupees % 10 > 0) {
        words += ' ' + ones[rupees % 10];
      }
    }
  }
  
  // Handle paise part
  const paise = Math.round((num - Math.floor(num)) * 100);
  if (paise > 0) {
    if (words !== '') words += ' and ';
    words += convertNumberToWords(paise) + ' Paise';
  }
  
  return words.trim().replace(/\s+/g, ' ');
};

// PDF Generation Component
const PDFTemplate = ({ reimbursement }: { reimbursement: Reimbursement }) => {
  const totalAmount = reimbursement.items?.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0) || 0;
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', fontSize: '12px', width: '210mm', minHeight: '297mm', position: 'relative' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Employee Reimbursement Form</h1>
      </div>

      {/* Company and Employee Information */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <strong>Company Name:</strong> {reimbursement.companyName || 'N/A'}
          </div>
          <div>
            <strong>Employee Name:</strong> {reimbursement.employeeName || 'N/A'}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
         
          <div>
            <strong>Branch:</strong> {reimbursement.branchName || 'N/A'}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <strong>Salary Period:</strong> {reimbursement.date || 'N/A'}
          </div>
          <div>
            <strong>Approval Type:</strong> {reimbursement.approvalType || 'N/A'}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #000' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Date</th>
            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Description</th>
            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Category</th>
            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {reimbursement.items?.map((item, index) => (
            <tr key={index}>
              <td style={{ border: '1px solid #000', padding: '8px' }}>{new Date().toLocaleDateString()}</td>
              <td style={{ border: '1px solid #000', padding: '8px' }}>{item.description || 'N/A'}</td>
              <td style={{ border: '1px solid #000', padding: '8px' }}>{item.reimbursementType || 'N/A'}</td>
              <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>₹{parseFloat(item.amount || "0").toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
            <td colSpan={3} style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>Total:</td>
            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>₹{totalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Amount in Words */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px' }}>
        <strong>Amount in Words:</strong> {convertNumberToWords(totalAmount)} rupees only
      </div>

      {/* Payment Details Section */}
      {(reimbursement.paymentMode || reimbursement.paymentDate) && (
        <div style={{ marginBottom: '100px', padding: '15px', border: '1px solid #000', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>
            Payment Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {reimbursement.paymentMode && (
              <div>
                <strong>Payment Mode:</strong> {reimbursement.paymentMode}
              </div>
            )}
            {reimbursement.paymentType && reimbursement.paymentType !== 'Cash' && (
              <div>
                <strong>Payment Type:</strong> {reimbursement.paymentType}
              </div>
            )}
            {reimbursement.paymentDate && (
              <div>
                <strong>Payment Date:</strong> {reimbursement.paymentDate}
              </div>
            )}
            {reimbursement.paymentProof && (
              <div>
                <strong>Payment Proof:</strong> {reimbursement.paymentProof}
              </div>
            )}
            {reimbursement.voucherCode && (
              <div>
                <strong>Voucher Code:</strong> {reimbursement.voucherCode}
              </div>
            )}
            {reimbursement.paymentRemark && (
              <div style={{ gridColumn: '1 / -1' }}>
                <strong>Payment Remark:</strong> {reimbursement.paymentRemark}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        position: 'absolute', 
        bottom: '60px', 
        width: 'calc(100% - 40px)',
        marginTop: '30px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderBottom: '1px solid #000', width: '200px', marginBottom: '5px', height: '40px' }}></div>
          <div style={{ fontWeight: 'bold' }}>Employee Signature</div>
          <div style={{ fontSize: '10px', marginTop: '5px' }}>Date: {new Date().toLocaleDateString()}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderBottom: '1px solid #000', width: '200px', marginBottom: '5px', height: '40px' }}></div>
          <div style={{ fontWeight: 'bold' }}>Approval Signature</div>
          <div style={{ fontSize: '10px', marginTop: '5px' }}>Date: {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* Footer Note */}
      <div style={{ 
        textAlign: 'center', 
        fontSize: '10px', 
        color: '#666', 
        position: 'absolute', 
        bottom: '20px', 
        width: 'calc(100% - 40px)'
      }}>
        *Don't forget to attach receipts with this form*
      </div>
    </div>
  );
};

export function ReimbursementManagement() {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Reimbursement | null>(null)
  const [settingsReimbursement, setSettingsReimbursement] = useState<Reimbursement | null>(null)
  const [paymentReimbursement, setPaymentReimbursement] = useState<Reimbursement | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [salaryCycles, setSalaryCycles] = useState<SalaryCycle[]>([])

  // Settings modal states
  const [approvalType, setApprovalType] = useState<"Salary" | "Voucher" | "">("")
  const [salaryPeriodOptions, setSalaryPeriodOptions] = useState<string[]>([])
  const [selectedSalaryPeriod, setSelectedSalaryPeriod] = useState("")
  const [voucherCode, setVoucherCode] = useState("")
  const [voucherDate, setVoucherDate] = useState("")
  const [settingsItems, setSettingsItems] = useState<ReimbursementItem[]>([])

  // Payment modal states
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Bank" | "">("")
  const [paymentType, setPaymentType] = useState<"Cash" | "Cheque" | "UPI" | "Bank Transfer" | "">("")
  const [paymentDate, setPaymentDate] = useState("")
  const [paymentRemark, setPaymentRemark] = useState("")
  const [paymentProof, setPaymentProof] = useState("")
  const [employeeBankDetails, setEmployeeBankDetails] = useState<EmployeeBankDetails | null>(null)
  const [isLoadingBankDetails, setIsLoadingBankDetails] = useState(false)
  const [managerData, setManagerData] = useState<any>(null);
const [empCreds, setEmpCreds] = useState<any>(null);

  const user = useCurrentUser()
const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER"
const isEmployee = !canManage

  const [formData, setFormData] = useState({
    serviceProvider: "",
    
    companyName: "",
    branchName: "",
    employeeName: "",
    date: new Date().toISOString().split('T')[0],
    status: "Pending",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    manageEmployeeID: undefined as number | undefined,
    serviceProviderName: "",
  })

  const [items, setItems] = useState<ReimbursementItem[]>([
    { reimbursementType: "", amount: "", description: "" },
  ])

  const pdfRef = useRef<HTMLDivElement>(null);


  const resolvedServiceProviderID =
  user?.role === "MANAGER"
    ? managerData?.serviceProviderID
    : formData.serviceProviderID;

const resolvedCompanyID =
  user?.role === "MANAGER"
    ? managerData?.companyID
    : formData.companyID;

const resolvedBranchID = formData.branchesID;


  // ---------- PDF Generation ----------
  const generatePDF = async (reimbursement: Reimbursement) => {
    const element = document.createElement('div');
    element.style.width = '210mm';
    element.style.minHeight = '297mm';
    element.style.padding = '20px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.fontSize = '12px';
    element.style.backgroundColor = 'white';
    element.style.boxSizing = 'border-box';
    element.style.position = 'relative';

    const totalAmount = reimbursement.items?.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0) || 0;
    
    element.innerHTML = `
      <div style="padding: 0; position: relative; min-height: 277mm;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #2c3e50; padding-bottom: 15px;">
          <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 5px 0; color: #2c3e50;">Employee Reimbursement Form</h1>
          <div style="font-size: 11px; color: #666;">Official Document</div>
        </div>

        <!-- Company and Employee Information -->
        <div style="margin-bottom: 25px; background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <div style="flex: 1;">
              <strong style="color: #2c3e50;">Company Name:</strong><br>
              <span style="font-size: 13px;">${reimbursement.companyName || 'N/A'}</span>
            </div>
            <div style="flex: 1;">
              <strong style="color: #2c3e50;">Employee Name:</strong><br>
              <span style="font-size: 13px;">${reimbursement.employeeName || 'N/A'}</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            
            <div style="flex: 1;">
              <strong style="color: #2c3e50;">Branch:</strong><br>
              <span style="font-size: 13px;">${reimbursement.branchName || 'N/A'}</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <div style="flex: 1;">
              <strong style="color: #2c3e50;">Salary Period:</strong><br>
              <span style="font-size: 13px;">${reimbursement.date || 'N/A'}</span>
            </div>
            <div style="flex: 1;">
              <strong style="color: #2c3e50;">Approval Type:</strong><br>
              <span style="font-size: 13px;">${reimbursement.approvalType || 'N/A'}</span>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #2c3e50; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
            Reimbursement Items
          </h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; font-size: 11px;">
            <thead>
              <tr style="background-color: #2c3e50; color: white;">
                <th style="border: 1px solid #ddd; padding: 10px 8px; text-align: left; font-weight: bold;">Date</th>
                <th style="border: 1px solid #ddd; padding: 10px 8px; text-align: left; font-weight: bold;">Description</th>
                <th style="border: 1px solid #ddd; padding: 10px 8px; text-align: left; font-weight: bold;">Category</th>
                <th style="border: 1px solid #ddd; padding: 10px 8px; text-align: right; font-weight: bold;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${reimbursement.items?.map((item, index) => `
                <tr key="${index}" style="${index % 2 === 0 ? 'background-color: #f8f9fa;' : ''}">
                  <td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">${new Date().toLocaleDateString('en-IN')}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">
                    <strong>${item.description || 'N/A'}</strong>
                  </td>
                  <td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">
                    <span style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 10px;">
                      ${item.reimbursementType || 'N/A'}
                    </span>
                  </td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: right; vertical-align: top; font-weight: 500;">
                    ₹${parseFloat(item.amount || "0").toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #2c3e50;">
                <td colspan="3" style="border: 1px solid #ddd; padding: 10px 8px; text-align: right; font-size: 12px;">
                  Total Amount:
                </td>
                <td style="border: 1px solid #ddd; padding: 10px 8px; text-align: right; font-size: 12px; color: #2c3e50;">
                  ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Amount in Words -->
        <div style="margin-bottom: 25px; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #2c3e50;">
          <strong style="color: #2c3e50; font-size: 11px;">Amount in Words:</strong><br>
          <span style="font-size: 11px; font-style: italic;">
            ${convertNumberToWords(totalAmount)} rupees only
          </span>
        </div>

        <!-- Payment Details Section -->
        ${(reimbursement.paymentMode || reimbursement.paymentDate) ? `
          <div style="margin-bottom: 25px; padding: 15px; border: 1px solid #2c3e50; border-radius: 8px; background: #f8f9fa;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #2c3e50; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
              Payment Details
            </h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px;">
              ${reimbursement.paymentMode ? `
                <div>
                  <strong style="color: #2c3e50;">Payment Mode:</strong><br>
                  <span>${reimbursement.paymentMode}</span>
                </div>
              ` : ''}
              ${reimbursement.paymentType && reimbursement.paymentType !== 'Cash' ? `
                <div>
                  <strong style="color: #2c3e50;">Payment Type:</strong><br>
                  <span>${reimbursement.paymentType}</span>
                </div>
              ` : ''}
              ${reimbursement.paymentDate ? `
                <div>
                  <strong style="color: #2c3e50;">Payment Date:</strong><br>
                  <span>${reimbursement.paymentDate}</span>
                </div>
              ` : ''}
              ${reimbursement.paymentProof ? `
                <div>
                  <strong style="color: #2c3e50;">Payment Proof:</strong><br>
                  <span>${reimbursement.paymentProof}</span>
                </div>
              ` : ''}
              ${reimbursement.voucherCode ? `
                <div>
                  <strong style="color: #2c3e50;">Voucher Code:</strong><br>
                  <span>${reimbursement.voucherCode}</span>
                </div>
              ` : ''}
              ${reimbursement.paymentRemark ? `
                <div style="grid-column: 1 / -1;">
                  <strong style="color: #2c3e50;">Payment Remark:</strong><br>
                  <span>${reimbursement.paymentRemark}</span>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Signatures -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; position: absolute; bottom: 80px; width: calc(100% - 40px);">
          <div style="text-align: center; flex: 1;">
            <div style="border-bottom: 1px solid #333; width: 200px; margin: 0 auto 8px auto; padding-top: 40px;"></div>
            <div style="font-weight: bold; font-size: 12px;">Employee Signature</div>
            <div style="font-size: 10px; color: #666; margin-top: 4px;">
              Date: ${new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="border-bottom: 1px solid #333; width: 200px; margin: 0 auto 8px auto; padding-top: 40px;"></div>
            <div style="font-weight: bold; font-size: 12px;">Approval Signature</div>
            <div style="font-size: 10px; color: #666; margin-top: 4px;">
              Date: ${new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
        </div>

        <!-- Footer Note -->
        <div style="text-align: center; font-size: 10px; color: #666; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; position: absolute; bottom: 20px; width: calc(100% - 40px);">
          <div style="margin-bottom: 5px;">
            <strong>Note:</strong> Please attach all original receipts with this form. Reimbursement will be processed as per company policy.
          </div>
          <div>Generated on: ${new Date().toLocaleString('en-IN')}</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(element);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: element.offsetWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add single page only
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      const fileName = `Reimbursement-${reimbursement.employeeName?.replace(/\s+/g, '_') || 'Unknown'}-${reimbursement.date?.replace(/\s+/g, '_') || 'NoDate'}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error generating PDF. Please try again.');
    } finally {
      document.body.removeChild(element);
    }
  };

  // ---------- APIs ----------
  async function robustGet<T = any>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }
  
  async function robustFetch(url: string, init?: RequestInit) {
    const res = await fetch(url, init)
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json().catch(() => ({}))
  }

  const fetchServiceProviders = async (q: string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/service-provider`)
    return data.filter((d) => (d.companyName || "").toLowerCase().includes(q.toLowerCase()))
  }
  
const fetchCompanies = async (q: string) => {
  if (!resolvedServiceProviderID) return [];

  const data = await robustGet<any[]>(`${BACKEND_URL}/company`);
  const query = q.toLowerCase();

  return data.filter(
    (c) =>
      c.serviceProviderID === resolvedServiceProviderID &&
      (c.companyName ?? "").toLowerCase().includes(query)
  );
};

  
const fetchBranches = async (q: string) => {
  try {
    // ❗ company must be resolved
    if (!resolvedCompanyID) return [];

    const data = await robustGet<any[]>(`${BACKEND_URL}/branches`);
    const query = q.toLowerCase();

    if (!Array.isArray(data)) return [];

    return data.filter(
      (b) =>
        b.companyID === resolvedCompanyID &&
        (b.branchName ?? b.name ?? "").toLowerCase().includes(query)
    );
  } catch (error) {
    console.error("Error fetching branches:", error);
    return [];
  }
};

  
const fetchEmployees = async (q: string) => {
  if (!resolvedCompanyID || !resolvedBranchID) return [];

  const data = await robustGet<any[]>(`${BACKEND_URL}/manage-emp`);
  const query = q.toLowerCase();

  return data.filter((e) => {
    const name = `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""}`
      .toLowerCase();
    const empId = (e.employeeID ?? "").toLowerCase();

    return (
      e.companyID === resolvedCompanyID &&
      e.branchesID === resolvedBranchID &&
      (name.includes(query) || empId.includes(query))
    );
  });
};


  // Fetch employee bank details
  const fetchEmployeeBankDetails = async (employeeId: number) => {
    if (!employeeId) return null
    
    setIsLoadingBankDetails(true)
    try {
      const data = await robustGet<any>(`${BACKEND_URL}/manage-emp/${employeeId}`)
      const bankDetails = data.employeeBankDetails?.[0] || null
      setEmployeeBankDetails(bankDetails)
      return bankDetails
    } catch (error) {
      console.error("Failed to fetch employee bank details:", error)
      setEmployeeBankDetails(null)
      return null
    } finally {
      setIsLoadingBankDetails(false)
    }
  }

  // Load companies and salary cycles on component mount
  useEffect(() => {
    loadCompanies()
    loadSalaryCycles()
  }, [])

  const loadCompanies = async () => {
    try {
      const data = await robustGet<Company[]>(`${BACKEND_URL}/company`)
      setCompanies(data)
    } catch (error) {
      console.error("Failed to load companies:", error)
    }
  }

  const loadSalaryCycles = async () => {
    try {
      const data = await robustGet<SalaryCycle[]>(`${BACKEND_URL}/salary-cycle`)
      setSalaryCycles(data)
    } catch (error) {
      console.error("Failed to load salary cycles:", error)
    }
  }

  // ---------- Load ----------
useEffect(() => {
  if (user) {
    loadReimbursements()
  }
}, [user])
  
 const loadReimbursements = async () => {
  const reimbursements = await robustGet<any[]>(`${BACKEND_URL}/reimbursement`)

  const mapped = reimbursements.map((r) => ({
    id: String(r.id),
    date: r.date || "",
    serviceProviderID: r.serviceProviderID,
    companyID: r.companyID,
    branchesID: r.branchesID,
    manageEmployeeID: r.manageEmployeeID,
    companyName: r.company?.companyName || "",
    branchName: r.branches?.branchName || "",
   employeeName: r.manageEmployee
      ? `${r.manageEmployee.employeeFirstName || ""} ${r.manageEmployee.employeeLastName || ""} (${r.manageEmployee.employeeID})`
      : "",
    reimbursementType: r.reimbursementType || "",
    amount: r.amount || "",
    description: r.description || "",
    status: r.status || "Pending",
    // Add these fields for approval system
    approvalType: r.approvalType || "",
    voucherCode: r.voucherCode || "",
    voucherDate: r.voucherDate || "",
    // ✅ FIX: Fetch items from the correct API structure
    items: r.items || r.reimbursementItems || [],
    // Payment fields
    paymentMode: r.paymentMode || "",
    paymentType: r.paymentType || "",
    paymentDate: r.paymentDate || "",
    paymentRemark: r.paymentRemark || "",
    paymentProof: r.paymentProof || "",
  }))
  // === Role-based filtering ===
  if (user?.role === "SUPERADMIN") {
    setReimbursements(mapped)
    return
  }

  if (user?.role === "MANAGER") {
    try {
      const usersData = await robustGet<any[]>(`${BACKEND_URL}/users`)
      const currentUser = usersData.find((u) => u.username === user.username)
      if (currentUser) {
        const filtered = mapped.filter(
          (r) =>
            r.companyID === currentUser.companyID &&
            r.branchesID === currentUser.branchesID
        )
        setReimbursements(filtered)
        return
      }
    } catch (e) {
      console.error("Error fetching /users for MANAGER", e)
    }
  }

  // Normal user: filter by /manage-emp/credentials/all
  try {
    const creds = await robustGet<any[]>(`${BACKEND_URL}/manage-emp/credentials/all`)
    const emp = user ? creds.find((c) => c.username === user.username) : null
    if (emp) {
      const filtered = mapped.filter(
        (r) =>
          r.companyID === emp.companyID &&
          r.branchesID === emp.branchesID &&
          r.manageEmployeeID === emp.employeeID
      )
      setReimbursements(filtered)
    } else {
      setReimbursements([])
    }
  } catch (err) {
    console.error("Error fetching credentials/all for EMPLOYEE", err)
    setReimbursements([])
  }
}

  // ---------- Salary Period Handlers ----------
  const refreshSalaryPeriodOptions = async (companyId: number) => {
    try {
      const company = companies.find(c => c.id === companyId)
      const fyStart = company?.financialYearStart || "1st April"
      
      const companySalaryCycles = salaryCycles.filter(sc => sc.companyID === companyId)
      const latestCycle = companySalaryCycles[0]
      const startDay = latestCycle?.monthStartDay || "1"

      const periodOptions = buildSalaryPeriodLabels(fyStart, startDay)
      setSalaryPeriodOptions(periodOptions)
      setSelectedSalaryPeriod(periodOptions[0] || "")

    } catch (error) {
      console.error("Failed to refresh salary period options:", error)
      setSalaryPeriodOptions([])
      setSelectedSalaryPeriod("")
    }
  }

  // ---------- Form handlers ----------
  const handleEmployeeSelect = (selected: SelectedItem) => {
    const emp = selected.item
    setFormData((p) => ({
      ...p,
      employeeName: selected.display,
      manageEmployeeID: selected.value,
    }))
  }

  const handleCompanySelect = (selected: SelectedItem) => {
    const company = selected.item
    setFormData((p) => ({
      ...p,
      companyName: selected.display,
      companyID: selected.value,
    }))
  }

  const resetForm = () => {
    setFormData({
      serviceProvider: "",
      companyName: "",
      branchName: "",
      employeeName: "",
      date: new Date().toISOString().split('T')[0],
      status: "Pending",
      serviceProviderID: undefined,
      companyID: undefined,
      branchesID: undefined,
      manageEmployeeID: undefined,
      serviceProviderName: "",
    })
    setItems([{ reimbursementType: "", amount: "", description: "" }])
    setEditing(null)
  }

  const resetSettingsForm = () => {
    setApprovalType("")
    setSalaryPeriodOptions([])
    setSelectedSalaryPeriod("")
    setVoucherCode("")
    setVoucherDate("")
    setSettingsItems([])
    setSettingsReimbursement(null)
  }

  const resetPaymentForm = () => {
    setPaymentMode("")
    setPaymentType("")
    setPaymentDate("")
    setPaymentRemark("")
    setPaymentProof("")
    setPaymentReimbursement(null)
    setEmployeeBankDetails(null)
  }

  const addItemRow = () => setItems((p) => [...p, { reimbursementType: "", amount: "", description: "" }])
  const removeItemRow = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx))
  const updateItemRow = (idx: number, key: keyof ReimbursementItem, val: string) =>
    setItems((p) => p.map((row, i) => (i === idx ? { ...row, [key]: val } : row)))

  const addSettingsItemRow = () => setSettingsItems((p) => [...p, { reimbursementType: "", amount: "", description: "" }])
  const removeSettingsItemRow = (idx: number) => setSettingsItems((p) => p.filter((_, i) => i !== idx))
  const updateSettingsItemRow = (idx: number, key: keyof ReimbursementItem, val: string) =>
    setSettingsItems((p) => p.map((row, i) => (i === idx ? { ...row, [key]: val } : row)))

  // Load mapping for MANAGER
useEffect(() => {
  if (user?.role !== "MANAGER") return;

  (async () => {
    try {
      const users = await robustGet<any[]>(`${BACKEND_URL}/users`);
      const me = users.find((u: any) => u.username === user.username);
      setManagerData(me || null);
    } catch (e) {
      console.error("Manager mapping fetch failed:", e);
      setManagerData(null);
    }
  })();
}, [user]);


  // ---------- CRUD actions ----------
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  let payload: any = {
    date: formData.date,
    status: formData.status,
    items: items.map(i => ({
      reimbursementType: i.reimbursementType,
      amount: i.amount,
      description: i.description,
    }))
  };

  // SUPERADMIN
  if (user?.role === "SUPERADMIN") {
    payload.serviceProviderID = formData.serviceProviderID;
    payload.companyID = formData.companyID;
    payload.branchesID = formData.branchesID;
    payload.manageEmployeeID = formData.manageEmployeeID;

  }

  // MANAGER (auto)
  if (user?.role === "MANAGER" && managerData) {
    payload.serviceProviderID = managerData.serviceProviderID;
    payload.companyID = managerData.companyID;
    payload.branchesID = managerData.branchesID;
    payload.manageEmployeeID = formData.manageEmployeeID;

  }

  // EMPLOYEE (auto)
  if (user?.role !== "SUPERADMIN" && user?.role !== "MANAGER" && empCreds) {
    payload.serviceProviderID = empCreds.serviceProviderID;
    payload.companyID = empCreds.companyID;
    payload.branchesID = empCreds.branchesID;
    payload.manageEmployeeID = empCreds.employeeID;
    
  }

  if (editing) {
    await robustFetch(`${BACKEND_URL}/reimbursement/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } else {
    await robustFetch(`${BACKEND_URL}/reimbursement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  await loadReimbursements();
  resetForm();
  setIsDialogOpen(false);
  toast.success("Reimbursement saved successfully");
};


  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settingsReimbursement) return
    if (!approvalType) { toast.error("Please select Approval Type"); return }
    if (approvalType === "Salary" && !selectedSalaryPeriod) { toast.error("Please select Salary Period"); return }
    if (approvalType === "Voucher" && (!voucherCode || !voucherDate)) { toast.error("Please fill all voucher fields"); return }

    const payload = {
      approvalType,
      date: approvalType === "Salary" ? selectedSalaryPeriod : settingsReimbursement.date,
      voucherCode: approvalType === "Voucher" ? voucherCode : null,
      voucherDate: approvalType === "Voucher" ? voucherDate : null,
      status: "Approved",
      items: settingsItems.map(i => ({
        reimbursementType: i.reimbursementType,
        amount: i.amount,
        description: i.description,
      })),
    }

    await robustFetch(`${BACKEND_URL}/reimbursement/${settingsReimbursement.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    await loadReimbursements()
    resetSettingsForm()
    setIsSettingsDialogOpen(false)
    toast.success("Settings saved successfully")
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentReimbursement) return
    if (!paymentMode) { toast.error("Please select Payment Mode"); return }
    if (paymentMode === "Bank" && !paymentType) { toast.error("Please select Payment Type"); return }
    if (!paymentDate) { toast.error("Please select Payment Date"); return }
    if (paymentMode === "Bank" && paymentType === "Cheque" && !paymentProof) { toast.error("Please enter Cheque Number"); return }
    if (paymentMode === "Bank" && paymentType === "UPI" && !paymentProof) { toast.error("Please enter UTR Number"); return }
    if (paymentMode === "Bank" && paymentType === "Bank Transfer" && !paymentProof) { toast.error("Please enter Transaction Reference Number"); return }

    const payload = {
      paymentMode,
      paymentType: paymentMode === "Bank" ? paymentType : "Cash",
      paymentDate,
      paymentRemark,
      paymentProof: paymentMode === "Bank" ? paymentProof : null,
      status: "Paid",
    }

    await robustFetch(`${BACKEND_URL}/reimbursement/${paymentReimbursement.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    await loadReimbursements()
    resetPaymentForm()
    setIsPaymentDialogOpen(false)
    toast.success("Payment recorded successfully")
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reimbursement?")) return
    await robustFetch(`${BACKEND_URL}/reimbursement/${id}`, { method: "DELETE" })
    await loadReimbursements()
  }

  const handleEdit = (r: Reimbursement) => {
    setEditing(r)
    setFormData({
      serviceProvider: r.serviceProvider || "",
      companyName: r.companyName || "",
      branchName: r.branchName || "",
      employeeName: r.employeeName || "",
      date: r.date || new Date().toISOString().split('T')[0],
      status: "Pending", // Reset to Pending when editing
      serviceProviderID: r.serviceProviderID,
      companyID: r.companyID,
      branchesID: r.branchesID,
      manageEmployeeID: r.manageEmployeeID,
      serviceProviderName: r.serviceProvider || "",
    })
    setItems(r.items || [{ reimbursementType: "", amount: "", description: "" }])
    setIsDialogOpen(true)
  }

  const handleSettings = (r: Reimbursement) => {
    setSettingsReimbursement(r)
    setApprovalType(r.approvalType as "Salary" | "Voucher" || "")
    setVoucherCode(r.voucherCode || "")
    setVoucherDate(r.voucherDate || "")
    setSettingsItems(r.items || [])
    
    // Load salary period options if company exists
    if (r.companyID) {
      refreshSalaryPeriodOptions(r.companyID)
    }
    
    setIsSettingsDialogOpen(true)
  }

  const handlePayment = async (r: Reimbursement) => {
    setPaymentReimbursement(r)
    setPaymentMode(r.paymentMode as "Cash" | "Bank" | "")
    setPaymentType(r.paymentType as "Cash" | "Cheque" | "UPI" | "Bank Transfer" | "")
    setPaymentDate(r.paymentDate || new Date().toISOString().split('T')[0])
    setPaymentRemark(r.paymentRemark || "")
    setPaymentProof(r.paymentProof || "")
    
    // Fetch employee bank details if employee ID exists
    if (r.manageEmployeeID) {
      await fetchEmployeeBankDetails(r.manageEmployeeID)
    } else {
      setEmployeeBankDetails(null)
    }
    
    setIsPaymentDialogOpen(true)
  }

  // ---------- Accept/Reject Handlers ----------
  const handleAccept = (r: Reimbursement) => {
    setSettingsReimbursement(r)
    setApprovalType("" as "Salary" | "Voucher" | "")
    setVoucherCode("")
    setVoucherDate("")
    setSettingsItems(r.items || [])
    
    // Load salary period options if company exists
    if (r.companyID) {
      refreshSalaryPeriodOptions(r.companyID)
    }
    
    setIsSettingsDialogOpen(true)
  }

  const handleReject = async (r: Reimbursement) => {
    if (!confirm("Are you sure you want to reject this reimbursement?")) return

    const payload = {
      status: "Rejected",
    }

    await robustFetch(`${BACKEND_URL}/reimbursement/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    await loadReimbursements()
    toast.success("Reimbursement rejected successfully")
  }

  const filteredReimbursements = reimbursements.filter((r) =>
    Object.values(r).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  // Calculate total amount for payment modal
const getTotalAmount = (reimbursement: Reimbursement) => {
  return reimbursement.items?.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0) || 0
}

return (
    <div className="space-y-6 p-6 bg-[#f8fafc] min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-gray-600 mt-2">Manage employee reimbursements and approvals efficiently</p>
        </div>
        <Button 
onClick={async () => {
  resetForm();

  // === MANAGER AUTO-FILL ===
  if (user?.role === "MANAGER") {
    const users = await robustGet<any[]>(`${BACKEND_URL}/users`);
    const me = users.find((u: any) => u.username === user.username);
    if (me) {
      setFormData((p) => ({
        ...p,
        serviceProviderID: me.serviceProviderID,
        companyID: me.companyID,
        branchesID: me.branchesID,
        branchName: me.branchName ?? "",
      }));
    }
  }

  // === EMPLOYEE AUTO-FILL ===
  if (user?.role !== "SUPERADMIN" && user?.role !== "MANAGER") {
    const creds = await robustGet<any[]>(
      `${BACKEND_URL}/manage-emp/credentials/all`
    );
    const emp = creds.find((c) => c.username === user?.username);

    if (emp) {
      setFormData((p) => ({
        ...p,
        serviceProviderID: emp.serviceProviderID,
        companyID: emp.companyID,
        branchesID: emp.branchesID,
        manageEmployeeID: emp.employeeID,
        branchName: emp.branchName,
      }));
    }
  }

  setIsDialogOpen(true);
}}
          className="bg-[#4f46e5] hover:bg-[#4338ca] px-6 py-2 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Reimbursement
        </Button>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search reimbursements by employee, company, branch, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 py-2 rounded-lg border-gray-300 focus:border-blue-500"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Stats Card */}
        <Card className="bg-[#eef2ff] border-[#d1d5db]">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#4f46e5]">{filteredReimbursements.length}</div>
              <div className="text-sm text-[#4338ca] mt-1">Total Reimbursements</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#eef2ff]/50 hover:bg-[#eef2ff]/50">
                  <TableHead className="font-semibold text-gray-900">Employee</TableHead>
                  <TableHead className="font-semibold text-gray-900">Company</TableHead>
                  <TableHead className="font-semibold text-gray-900">Branch</TableHead>
                  <TableHead className="font-semibold text-gray-900">Date/Period</TableHead>
                  <TableHead className="font-semibold text-gray-900">Amount</TableHead>
                  <TableHead className="font-semibold text-gray-900">Status</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReimbursements.map((r) => {
                  const totalAmount = getTotalAmount(r)
                  return (
                    <TableRow key={r.id} className="hover:bg-[#eef2ff]/40 border-b border-[#e5e7eb]">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          {r.employeeName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          {r.companyName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          {r.branchName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {r.date}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-green-700">
                        ₹{totalAmount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            r.status === "Paid"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : r.status === "Approved"
                              ? "bg-blue-100 text-blue-800 border-blue-200"
                              : r.status === "Rejected"
                              ? "bg-red-100 text-red-800 border-red-200"
                              : "bg-yellow-100 text-yellow-800 border-yellow-200"
                          }
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
  {/* ✅ SUPERADMIN / MANAGER actions */}
  {canManage && (
    <>
      {r.status === "Pending" && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleAccept(r)}
            className="h-8 w-8 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg"
            title="Accept"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleReject(r)}
            className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
            title="Reject"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleSettings(r)}
            className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </>
      )}

      {r.status === "Approved" && r.approvalType === "Voucher" && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handlePayment(r)}
          className="h-8 w-8 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg"
          title="Make Payment"
        >
          <CreditCard className="h-4 w-4" />
        </Button>
      )}
    </>
  )}

  {/* ✅ All roles can download */}
  <Button
    variant="ghost"
    size="icon"
    onClick={() => generatePDF(r)}
    className="h-8 w-8 text-gray-600 hover:text-[#4f46e5] hover:bg-[#eef2ff] rounded-lg"
    title="Download PDF"
  >
    <Download className="h-4 w-4" />
  </Button>

  {/* ✅ Normal Employee (cannot approve/reject/make payment) */}
  {isEmployee && r.status !== "Approved" && (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleEdit(r)}
        className="h-8 w-8 text-gray-600 hover:text-[#4f46e5] hover:bg-[#eef2ff] rounded-lg"
        title="Edit"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleDelete(r.id)}
        className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  )}
</div>

                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editing ? "Edit Reimbursement" : "Create New Reimbursement"}
            </DialogTitle>
          </DialogHeader>
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
               {/* SUPERADMIN → show SP + Company + Branch normally */}
{user?.role === "SUPERADMIN" && (
<div className="grid grid-cols-1 gap-4">
               
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    {/* Service Provider */}
    <SearchSuggestInput
      label="Service Provider"
      placeholder="Search service provider..."
      value={formData.serviceProviderName}
      onChange={(v) =>
        setFormData((p) => ({
          ...p,
          serviceProviderName: v,
          serviceProviderID: undefined,
        }))
      }
      onSelect={(s) =>
        setFormData((p) => ({
          ...p,
          serviceProviderID: s.value,
          serviceProviderName: s.display,
        }))
      }
      fetchData={fetchServiceProviders}
      displayField="companyName"
      valueField="id"
      required
    />

    {/* Company */}
    <SearchSuggestInput
      label="Company"
      placeholder="Search company..."
      value={formData.companyName}
      onChange={(v) =>
        setFormData((p) => ({
          ...p,
          companyName: v,
          companyID: undefined,
        }))
      }
      onSelect={(s) =>
        setFormData((p) => ({
          ...p,
          companyID: s.value,
          companyName: s.display,
        }))
      }
      fetchData={fetchCompanies}
      displayField="companyName"
      valueField="id"
      required
    />

    {/* Branch */}
    <SearchSuggestInput
      label="Branch"
      placeholder="Search branch..."
      value={formData.branchName}
      onChange={(v) => setFormData((p) => ({ ...p, branchName: v }))}
      onSelect={(s) =>
        setFormData((p) => ({
          ...p,
          branchesID: s.value,
          branchName: s.display,
        }))
      }
fetchData={(q) => fetchBranches(q)}
      displayField="branchName"
      valueField="id"
      required
    />
  </div>
  </div>
)}

{/* MANAGER → only Branch input, SP + Company hidden */}
{user?.role === "MANAGER" && (
  <div className="grid grid-cols-1 gap-4">
    <SearchSuggestInput
      label="Branch"
      placeholder="Select Branch"
      value={formData.branchName}
      onChange={(v) => setFormData((p) => ({ ...p, branchName: v }))}
      onSelect={(s) =>
        setFormData((p) => ({
          ...p,
          branchesID: s.value,
          branchName: s.display,
        }))
      }
fetchData={(q) => fetchBranches(q)}
      displayField="branchName"
      valueField="id"
      required
    />
  </div>
)}

{/* EMPLOYEE → No SP / Company / Branch fields at all */}
{user?.role !== "SUPERADMIN" && user?.role !== "MANAGER" && (
  <></>
)}


                {/* Employee */}
                <div className="space-y-3">
                 
                  <SearchSuggestInput
                    label="Employee"
                    placeholder="Search employee..."
                    value={formData.employeeName}
                    onChange={(value: string) => setFormData(p => ({ ...p, employeeName: value }))}
                    onSelect={handleEmployeeSelect}
                    fetchData={async (q: string) => {
                      const data = await fetchEmployees(q)
                      return data.map((emp: any) => ({
                        ...emp,
                        display: `${emp.employeeFirstName || ""} ${emp.employeeLastName || ""} (${emp.employeeID})`,
                        value: emp.id,
                      }))
                    }}
                    displayField="display"
                    valueField="value"
                    required
                  />
                </div>

                {/* Date */}
                <div className="space-y-3">
                  <Label htmlFor="date" className="text-sm font-medium text-gray-700">
                    Date 
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold text-gray-900">Reimbursement Items</Label>
                  <Button type="button" onClick={addItemRow} variant="outline" size="sm" className="rounded-lg">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start border border-gray-200 p-4 rounded-lg bg-white shadow-sm">
                      <div className="md:col-span-4 space-y-2">
                        <Label htmlFor={`type-${idx}`} className="text-sm font-medium text-gray-700">Type *</Label>
                        <Input
                          id={`type-${idx}`}
                          value={item.reimbursementType}
                          onChange={(e) => updateItemRow(idx, "reimbursementType", e.target.value)}
                          placeholder="e.g., Travel, Food, etc."
                          className="border-gray-300 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div className="md:col-span-3 space-y-2">
                        <Label htmlFor={`amount-${idx}`} className="text-sm font-medium text-gray-700">Amount (₹) *</Label>
                        <Input
                          id={`amount-${idx}`}
                          type="number"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) => updateItemRow(idx, "amount", e.target.value)}
                          placeholder="0.00"
                          className="border-gray-300 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div className="md:col-span-4 space-y-2">
                        <Label htmlFor={`description-${idx}`} className="text-sm font-medium text-gray-700">Description *</Label>
                        <Input
                          id={`description-${idx}`}
                          value={item.description}
                          onChange={(e) => updateItemRow(idx, "description", e.target.value)}
                          placeholder="Description of expense"
                          className="border-gray-300 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div className="md:col-span-1 space-y-2 flex justify-center pt-6">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length === 1}
                          className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                        >
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-[#f8fafc] sticky bottom-0">
            <div className="flex gap-3 w-full">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="flex-1 border-[#d1d5db] hover:bg-[#eef2ff] rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={handleSubmit}
                className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] rounded-lg"
              >
                {editing ? "Update Reimbursement" : "Create Reimbursement"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings/Approve Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-green-800">
              Approve Reimbursement
            </DialogTitle>
          </DialogHeader>
          <div>
            <form onSubmit={handleSettingsSubmit} className="space-y-6">
              {settingsReimbursement && (
                <>
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#f8fafc] rounded-lg border border-[#d1d5db]">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Employee</Label>
                      <p className="text-sm font-semibold text-gray-900">{settingsReimbursement.employeeName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Company</Label>
                      <p className="text-sm font-semibold text-gray-900">{settingsReimbursement.companyName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Branch</Label>
                      <p className="text-sm font-semibold text-gray-900">{settingsReimbursement.branchName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Current Status</Label>
                      <p className="text-sm">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          {settingsReimbursement.status}
                        </Badge>
                      </p>
                    </div>
                  </div>

                  {/* Approval Type */}
                  <div className="space-y-4">
                    <Label className="text-lg font-semibold text-gray-900">Approval Type *</Label>
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant={approvalType === "Salary" ? "default" : "outline"}
                        className={`flex-1 py-3 rounded-lg ${approvalType === "Salary" ? "bg-[#4f46e5] hover:bg-[#4338ca]" : "border-[#d1d5db] hover:bg-[#eef2ff]"}`}
                        onClick={() => setApprovalType("Salary")}
                      >
                        Salary
                      </Button>
                      <Button
                        type="button"
                        variant={approvalType === "Voucher" ? "default" : "outline"}
                        className={`flex-1 py-3 rounded-lg ${approvalType === "Voucher" ? "" : "border-gray-300 hover:bg-gray-50"}`}
                        onClick={() => setApprovalType("Voucher")}
                      >
                        Voucher
                      </Button>
                    </div>
                  </div>

                  {/* Salary Period (only for Salary approval) */}
                  {approvalType === "Salary" && (
                    <div className="space-y-3">
                      <Label htmlFor="salaryPeriod" className="text-sm font-medium text-gray-700">Salary Period *</Label>
                      <select
                        id="salaryPeriod"
                        value={selectedSalaryPeriod}
                        onChange={(e) => setSelectedSalaryPeriod(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select Salary Period</option>
                        {salaryPeriodOptions.map((period, idx) => (
                          <option key={idx} value={period}>{period}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Voucher Details (only for Voucher approval) */}
                  {approvalType === "Voucher" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="voucherCode" className="text-sm font-medium text-gray-700">Voucher Code *</Label>
                        <Input
                          id="voucherCode"
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value)}
                          placeholder="Enter voucher code"
                          className="border-gray-300 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="voucherDate" className="text-sm font-medium text-gray-700">Voucher Date *</Label>
                        <Input
                          id="voucherDate"
                          type="date"
                          value={voucherDate}
                          onChange={(e) => setVoucherDate(e.target.value)}
                          className="border-gray-300 focus:border-blue-500"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Items Review/Edit */}
                  <div className="space-y-4 border-t pt-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-semibold text-gray-900">Reimbursement Items</Label>
                      <Button type="button" onClick={addSettingsItemRow} variant="outline" size="sm" className="rounded-lg">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Add Item
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {settingsItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start border border-gray-200 p-4 rounded-lg bg-white shadow-sm">
                          <div className="md:col-span-4 space-y-2">
                            <Label htmlFor={`settings-type-${idx}`} className="text-sm font-medium text-gray-700">Type *</Label>
                            <Input
                              id={`settings-type-${idx}`}
                              value={item.reimbursementType}
                              onChange={(e) => updateSettingsItemRow(idx, "reimbursementType", e.target.value)}
                              placeholder="e.g., Travel, Food, etc."
                              className="border-gray-300 focus:border-blue-500"
                              required
                            />
                          </div>
                          <div className="md:col-span-3 space-y-2">
                            <Label htmlFor={`settings-amount-${idx}`} className="text-sm font-medium text-gray-700">Amount (₹) *</Label>
                            <Input
                              id={`settings-amount-${idx}`}
                              type="number"
                              step="0.01"
                              value={item.amount}
                              onChange={(e) => updateSettingsItemRow(idx, "amount", e.target.value)}
                              placeholder="0.00"
                              className="border-gray-300 focus:border-blue-500"
                              required
                            />
                          </div>
                          <div className="md:col-span-4 space-y-2">
                            <Label htmlFor={`settings-description-${idx}`} className="text-sm font-medium text-gray-700">Description *</Label>
                            <Input
                              id={`settings-description-${idx}`}
                              value={item.description}
                              onChange={(e) => updateSettingsItemRow(idx, "description", e.target.value)}
                              placeholder="Description of expense"
                              className="border-gray-300 focus:border-blue-500"
                              required
                            />
                          </div>
                          <div className="md:col-span-1 space-y-2 flex justify-center pt-6">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSettingsItemRow(idx)}
                              disabled={settingsItems.length === 1}
                              className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </form>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-gray-50 sticky bottom-0">
            <div className="flex gap-3 w-full">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsSettingsDialogOpen(false)}
                className="flex-1 border-gray-300 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={handleSettingsSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700 rounded-lg"
              >
                <Check className="w-4 h-4 mr-2" />
                Approve Reimbursement
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog - UPDATED with Bank Transfer */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-green-800">
              Make Payment
            </DialogTitle>
          </DialogHeader>
          <div>
            <form onSubmit={handlePaymentSubmit} className="space-y-6">
              {paymentReimbursement && (
                <>
                  {/* Payment Information Display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-blue-700">Voucher Code</Label>
                      <p className="text-lg font-semibold text-blue-900">{paymentReimbursement.voucherCode || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-blue-700">Total Amount</Label>
                      <p className="text-lg font-semibold text-blue-900">₹{getTotalAmount(paymentReimbursement).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Employee</Label>
                      <p className="text-sm font-semibold text-gray-900">{paymentReimbursement.employeeName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Company</Label>
                      <p className="text-sm font-semibold text-gray-900">{paymentReimbursement.companyName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Current Status</Label>
                      <p className="text-sm">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                          {paymentReimbursement.status}
                        </Badge>
                      </p>
                    </div>
                  </div>

                  {/* Payment Mode */}
                  <div className="space-y-4">
                    <Label className="text-lg font-semibold text-gray-900">Payment Mode *</Label>
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant={paymentMode === "Cash" ? "default" : "outline"}
                        className={`flex-1 py-3 rounded-lg ${paymentMode === "Cash" ? "" : "border-gray-300 hover:bg-gray-50"}`}
                        onClick={() => {
                          setPaymentMode("Cash")
                          setPaymentType("Cash")
                        }}
                      >
                        Cash
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMode === "Bank" ? "default" : "outline"}
                        className={`flex-1 py-3 rounded-lg ${paymentMode === "Bank" ? "" : "border-gray-300 hover:bg-gray-50"}`}
                        onClick={() => setPaymentMode("Bank")}
                      >
                        Bank
                      </Button>
                    </div>
                  </div>

                  {/* Payment Type (only for Bank) */}
                  {paymentMode === "Bank" && (
                    <div className="space-y-4">
                      <Label className="text-lg font-semibold text-gray-900">Payment Type *</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Button
                          type="button"
                          variant={paymentType === "Cheque" ? "default" : "outline"}
                          className={`py-3 rounded-lg ${paymentType === "Cheque" ? "" : "border-gray-300 hover:bg-gray-50"}`}
                          onClick={() => setPaymentType("Cheque")}
                        >
                          Cheque
                        </Button>
                        <Button
                          type="button"
                          variant={paymentType === "UPI" ? "default" : "outline"}
                          className={`py-3 rounded-lg ${paymentType === "UPI" ? "" : "border-gray-300 hover:bg-gray-50"}`}
                          onClick={() => setPaymentType("UPI")}
                        >
                          UPI
                        </Button>
                        <Button
                          type="button"
                          variant={paymentType === "Bank Transfer" ? "default" : "outline"}
                          className={`py-3 rounded-lg ${paymentType === "Bank Transfer" ? "" : "border-gray-300 hover:bg-gray-50"}`}
                          onClick={() => setPaymentType("Bank Transfer")}
                        >
                          Bank Transfer
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Bank Details Display (for Bank Transfer) */}
                  {paymentMode === "Bank" && paymentType === "Bank Transfer" && employeeBankDetails && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="font-semibold text-green-800 mb-3">Employee Bank Details</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-green-700">Bank Name</Label>
                          <p className="text-sm font-semibold">{employeeBankDetails.bankName}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-green-700">Branch Name</Label>
                          <p className="text-sm font-semibold">{employeeBankDetails.bankBranchName}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-green-700">Account Number</Label>
                          <p className="text-sm font-semibold">{employeeBankDetails.accNumber}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-green-700">IFSC Code</Label>
                          <p className="text-sm font-semibold">{employeeBankDetails.ifscCode}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* UPI Details Display (for UPI) */}
                  {paymentMode === "Bank" && paymentType === "UPI" && employeeBankDetails && employeeBankDetails.upi && (
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h4 className="font-semibold text-purple-800 mb-3">Employee UPI Details</h4>
                      <div>
                        <Label className="text-sm font-medium text-purple-700">UPI ID</Label>
                        <p className="text-lg font-semibold">{employeeBankDetails.upi}</p>
                      </div>
                    </div>
                  )}

                  {/* Loading State */}
                  {paymentMode === "Bank" && isLoadingBankDetails && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                      <p className="text-sm text-gray-600 mt-2">Loading employee bank details...</p>
                    </div>
                  )}

                  {/* No Bank Details Found */}
                  {paymentMode === "Bank" && !isLoadingBankDetails && !employeeBankDetails && (
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        No bank details found for this employee. Please contact the employee to update their bank information.
                      </p>
                    </div>
                  )}

                  {/* Payment Proof */}
                  {paymentMode === "Bank" && (
                    <div className="space-y-3">
                      <Label htmlFor="paymentProof" className="text-sm font-medium text-gray-700">
                        {paymentType === "Cheque" && "Cheque Number *"}
                        {paymentType === "UPI" && "UTR Number *"}
                        {paymentType === "Bank Transfer" && "Transaction Reference Number *"}
                      </Label>
                      <Input
                        id="paymentProof"
                        value={paymentProof}
                        onChange={(e) => setPaymentProof(e.target.value)}
                        placeholder={
                          paymentType === "Cheque" ? "Enter cheque number" :
                          paymentType === "UPI" ? "Enter UTR number" :
                          "Enter transaction reference number"
                        }
                        className="border-gray-300 focus:border-blue-500"
                        required
                      />
                    </div>
                  )}

                  {/* Payment Date */}
                  <div className="space-y-3">
                    <Label htmlFor="paymentDate" className="text-sm font-medium text-gray-700">Payment Date *</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="border-gray-300 focus:border-blue-500"
                      required
                    />
                  </div>

                  {/* Remark */}
                  <div className="space-y-3">
                    <Label htmlFor="paymentRemark" className="text-sm font-medium text-gray-700">Remark</Label>
                    <Input
                      id="paymentRemark"
                      value={paymentRemark}
                      onChange={(e) => setPaymentRemark(e.target.value)}
                      placeholder="Enter payment remark (optional)"
                      className="border-gray-300 focus:border-blue-500"
                    />
                  </div>
                </>
              )}
            </form>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-gray-50 sticky bottom-0">
            <div className="flex gap-3 w-full">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsPaymentDialogOpen(false)}
                className="flex-1 border-gray-300 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={handlePaymentSubmit}
                disabled={paymentMode === "Bank" && !employeeBankDetails}
                className="flex-1 bg-green-600 hover:bg-green-700 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Mark as Paid
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden PDF Template */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={pdfRef}>
          {settingsReimbursement && <PDFTemplate reimbursement={settingsReimbursement} />}
        </div>
      </div>
    </div>
  )
}