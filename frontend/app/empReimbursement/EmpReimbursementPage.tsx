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
import { Search, Edit, Trash2, Plus, Download, User, Building, MapPin, Calendar } from "lucide-react"
import { Icon } from "@iconify/react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { toast } from "sonner"
import { getPageCache, setPageCache } from "../utils/pageCache"

interface ReimbursementItem {
  id?: number
  reimbursementType: string
  amount: string
  description: string
}


interface Employee {
  id: number
  employeeID: number
  serviceProviderID: number
  companyID: number
  branchesID: number
  employeeFirstName: string
  employeeLastName: string
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
  reimbursementType?: string
  amount?: string
  description?: string
  status: string
  approvalType?: string
  salaryPeriod?: string
  voucherCode?: string
  voucherDate?: string
  items?: ReimbursementItem[]
  paymentMode?: string
  paymentType?: string
  paymentDate?: string
  paymentRemark?: string
  paymentProof?: string
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"

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
{"*Don't forget to attach receipts with this form*"}
      </div>
    </div>
  );
};
    
export function EmpReimbursement() {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>(() => getPageCache<Reimbursement[]>("empReimbursements") ?? [])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Reimbursement | null>(null)
const [employee, setEmployee] = useState<Employee | null>(null)
    
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
  })
  
  const [items, setItems] = useState<ReimbursementItem[]>([
    { reimbursementType: "", amount: "", description: "" },
  ])
   
  const pdfRef = useRef<HTMLDivElement>(null);
  const user = useCurrentUser()

  console.log("CURRENT USER =>", user)

  
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
  
 useEffect(() => {
  if (!user?.username) return;

  // Use the credentials-by-username endpoint for reliable employee mapping
  robustGet(`${BACKEND_URL}/manage-emp/credentials/${encodeURIComponent(user.username)}`).then((creds: any) => {
    if (!creds || !creds.employee) {
      toast.error("Employee mapping not found");
      return;
    }

    const empRecord = {
      id: creds.employee.id,
      serviceProviderID: creds.serviceProviderID,
      companyID: creds.companyID,
      branchesID: creds.branchesID,
      employeeFirstName: creds.employee.employeeFirstName || "",
      employeeLastName: creds.employee.employeeLastName || "",
      employeeID: creds.employee.employeeID,
      company: creds.company,
      branches: creds.branches,
    };

    setEmployee(empRecord as any);

    setFormData(p => ({
      ...p,
      serviceProviderID: creds.serviceProviderID,
      companyID: creds.companyID,
      branchesID: creds.branchesID,
      manageEmployeeID: creds.employee.id,
      employeeName: (creds.employee.employeeFirstName || "") + " " + (creds.employee.employeeLastName || ""),
      companyName: creds.company?.companyName || "",
      branchName: creds.branches?.branchName || "",
    }));

    loadReimbursements(creds.employee.id);
  }).catch(() => {
    toast.error("Failed to load employee details. Please try again.");
  });

}, [user])

  // Poll for status updates every 15 s + refresh when app becomes visible
  useEffect(() => {
    if (!employee?.id) return;
    const empId = employee.id;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadReimbursements(empId);
    }, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadReimbursements(empId);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [employee?.id]);

  

  // ---------- Load Reimbursements ----------
const loadReimbursements = async (employeeId: number) => {
    try {      
  const data = await robustGet<any[]>(
`${BACKEND_URL}/reimbursement/employee/${employeeId}`
)
const filtered = data

      
   const mapped = filtered.map((r) => {
  const items =
    Array.isArray(r.items) && r.items.length > 0
      ? r.items
      : r.reimbursementType || r.amount || r.description
      ? [
          {
            reimbursementType: r.reimbursementType || "",
            amount: r.amount || "0",
            description: r.description || "",
          },
        ]
      : [];

  return {
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

    status: r.status || "Pending",
    approvalType: r.approvalType || "",
    voucherCode: r.voucherCode || "",
    voucherDate: r.voucherDate || "",

    items,                    // ✅ FINAL FIX

    paymentMode: r.paymentMode || "",
    paymentType: r.paymentType || "",
    paymentDate: r.paymentDate || "",
    paymentRemark: r.paymentRemark || "",
    paymentProof: r.paymentProof || "",
  };
});
      setPageCache("empReimbursements", mapped);
      setReimbursements(mapped);
    } catch (error) {
      console.error("Failed to load reimbursements:", error);
    }

  }

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

  // ---------- Form handlers ----------
 const resetForm = () => {
  setEditing(null)
if (employee) loadReimbursements(employee.id)
  setItems([{ reimbursementType: "", amount: "", description: "" }])
}

  const addItemRow = () => setItems((p) => [...p, { reimbursementType: "", amount: "", description: "" }])
  const removeItemRow = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx))
  const updateItemRow = (idx: number, key: keyof ReimbursementItem, val: string) =>
    setItems((p) => p.map((row, i) => (i === idx ? { ...row, [key]: val } : row)))

  // ---------- CRUD actions ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
                                              
    const payload = {
   serviceProviderID: employee?.serviceProviderID,
companyID: employee?.companyID,
branchesID: employee?.branchesID,
manageEmployeeID: employee?.id,

      date: formData.date,
      status: "Pending", // Always set to Pending when creating/editing
      items: items.map(i => ({
        reimbursementType: i.reimbursementType,
        amount: i.amount,
        description: i.description,
      })),
    }

    console.log("Submitting reimbursement:", payload);

    try {
      if (editing) {
        await robustFetch(`${BACKEND_URL}/reimbursement/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        await robustFetch(`${BACKEND_URL}/reimbursement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

if (employee) await loadReimbursements(employee.id)
      resetForm()
      setIsDialogOpen(false)
      toast.success("Reimbursement submitted successfully")
    } catch (error) {
      console.error("Error submitting reimbursement:", error)
      toast.error("Error submitting reimbursement. Please try again.")
    }
  }




  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reimbursement?")) return
    try {
      await robustFetch(`${BACKEND_URL}/reimbursement/${id}`, { method: "DELETE" })
if (employee) await loadReimbursements(employee.employeeID)
    } catch (error) {
      console.error("Error deleting reimbursement:", error)
      toast.error("Error deleting reimbursement. Please try again.")
    }
  }

  const handleEdit = (r: Reimbursement) => {
    setEditing(r)
    setFormData(prev => ({
      ...prev,
      date: r.date || new Date().toISOString().split('T')[0],
      status: "Pending",
    }))
    setItems(r.items || [{ reimbursementType: "", amount: "", description: "" }])
  }

  const filteredReimbursements = reimbursements.filter((r) =>
    Object.values(r).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  // Calculate total amount
  const getTotalAmount = (reimbursement: Reimbursement) => {
    return reimbursement.items?.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0) || 0
  }

  
  return (
    <div className="px-4 pt-5 pb-4 space-y-4 min-w-0 overflow-x-hidden">
      {/* Header */}
      <h1 className="text-[22px] font-bold text-gray-900">Reimbursement</h1>

      {/* Inline Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4 min-w-0 overflow-hidden">
        <p className="text-[13px] font-bold text-gray-700">{editing ? "Edit Request" : "New Request"}</p>

        {/* Date */}
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Date</p>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
            className="block w-full min-w-0 max-w-full box-border px-3 py-2.5 text-[13px] rounded-xl border border-gray-100 bg-gray-50 focus:outline-none appearance-none"
          />
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Items</p>
            <button
              onClick={addItemRow}
              className="flex items-center gap-1 text-[11px] font-bold text-blue-600 border border-blue-100 bg-blue-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]"
            >
              <Plus className="w-3 h-3" /> Add Row
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={item.reimbursementType}
                    onChange={(e) => updateItemRow(idx, "reimbursementType", e.target.value)}
                    placeholder="Category (Travel, Food…)"
                    className="flex-1 min-w-0 px-3 py-2 text-[13px] rounded-xl border border-gray-100 bg-white focus:outline-none"
                  />
                  <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => updateItemRow(idx, "amount", e.target.value)}
                    placeholder="₹ Amount"
                    className="flex-1 min-w-0 sm:w-28 sm:flex-none px-3 py-2 text-[13px] rounded-xl border border-gray-100 bg-white focus:outline-none"
                  />
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItemRow(idx)}
                      className="w-8 h-9 flex items-center justify-center text-red-400 border border-red-100 bg-red-50 rounded-xl active:scale-[0.95]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  </div>
                </div>
                <input
                  value={item.description}
                  onChange={(e) => updateItemRow(idx, "description", e.target.value)}
                  placeholder="Description of expense"
                  className="w-full px-3 py-2 text-[13px] rounded-xl border border-gray-100 bg-white focus:outline-none"
                />
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <p className="text-[12px] text-right font-bold text-emerald-700 mt-2">
              Total: ₹{items.reduce((s, i) => s + parseFloat(i.amount || "0"), 0).toFixed(2)}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={async () => {
            if (!items.some(i => i.reimbursementType && i.amount)) {
              alert("Please fill in at least one item with category and amount.");
              return;
            }
            const payload = {
              serviceProviderID: employee?.serviceProviderID,
              companyID: employee?.companyID,
              branchesID: employee?.branchesID,
              manageEmployeeID: employee?.id,
              date: formData.date,
              status: "Pending",
              items: items.map(i => ({
                reimbursementType: i.reimbursementType,
                amount: i.amount,
                description: i.description,
              })),
            };
            try {
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
              if (employee) await loadReimbursements(employee.id);
              resetForm();
              toast.success(editing ? "Reimbursement updated!" : "Reimbursement submitted!");
            } catch (e: any) {
              toast.error("Error: " + (e.message || "Failed to submit"));
            }
          }}
          className="w-full py-3.5 bg-[#2563eb] text-white font-bold text-[15px] rounded-2xl shadow-md shadow-blue-200 active:scale-[0.98] transition-transform"
        >
          {editing ? "Update Request" : "Submit Request"}
        </button>
        {editing && (
          <button onClick={resetForm} className="w-full py-2.5 text-[13px] font-semibold text-gray-500 rounded-xl bg-gray-50 border border-gray-100 active:scale-[0.98]">
            Cancel Edit
          </button>
        )}
      </div>

      {/* Recent Reimbursements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold text-gray-900">Recent Requests</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              placeholder="Search…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-[12px] rounded-xl border border-gray-100 bg-white shadow-sm focus:outline-none w-28"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredReimbursements.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-3">
              <Icon icon="solar:wallet-bold-duotone" className="w-12 h-12 text-gray-200" />
              <p className="text-[14px] font-semibold text-gray-400">No reimbursements yet</p>
            </div>
          ) : (
            filteredReimbursements.map((r) => {
              const totalAmount = getTotalAmount(r);
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-gray-900 truncate">
                        {r.items?.[0]?.reimbursementType || "Reimbursement"}
                        {(r.items?.length || 0) > 1 && <span className="ml-1 text-[11px] text-gray-400">+{(r.items?.length || 1) - 1} more</span>}
                      </p>
                      {r.companyName && <p className="text-[12px] text-gray-400 mt-0.5 truncate">{r.companyName}{r.branchName ? ` · ${r.branchName}` : ""}</p>}
                    </div>
                    <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      r.status === "Paid" ? "bg-green-100 text-green-700"
                      : r.status === "Approved" ? "bg-blue-100 text-blue-700"
                      : r.status === "Rejected" ? "bg-red-100 text-red-600"
                      : "bg-gray-100 text-gray-600"
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{r.date}</span>
                    </div>
                    <span className="text-[15px] font-bold text-emerald-700">₹{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-50">
                    <button onClick={() => generatePDF(r)} className="flex items-center gap-1 text-[11px] font-bold text-gray-600 border border-gray-100 bg-gray-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]">
                      <Download className="w-3 h-3" /> PDF
                    </button>
                    {r.status !== "Approved" && r.status !== "Paid" && (
                      <>
                        <button onClick={() => handleEdit(r)} className="flex items-center gap-1 text-[11px] font-bold text-gray-600 border border-gray-100 bg-gray-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]">
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="flex items-center gap-1 text-[11px] font-bold text-red-500 border border-red-100 bg-red-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Hidden PDF Template */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={pdfRef}>
          {reimbursements[0] && <PDFTemplate reimbursement={reimbursements[0]} />}
        </div>
      </div>
    </div>
  )
}
