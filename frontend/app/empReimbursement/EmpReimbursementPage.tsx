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
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { useCurrentUser } from "../hooks/useCurrentUser"

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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

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
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([])
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
  if (!user?.id) return

robustGet(`${BACKEND_URL}/manage-emp`).then((allEmp) => {

const emp = allEmp.find((e: any) =>
  Array.isArray(e.employeeCredentials) &&
  e.employeeCredentials.some(
    (c: any) => c.username === user.username
  )
);


  if (!emp) {
    alert("Employee mapping not found");
    return;
  }

  setEmployee(emp);

  setFormData(p => ({
    ...p,
    serviceProviderID: emp.serviceProviderID,
    companyID: emp.companyID,
    branchesID: emp.branchesID,
    manageEmployeeID: emp.id,              // ✅ FIXED
    employeeName: emp.employeeFirstName + " " + emp.employeeLastName,
    companyName: emp.company?.companyName || "",
    branchName: emp.branches?.branchName || "",
  }));

  loadReimbursements(emp.id);               // ✅ FIXED
});


}, [user])

  

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
      alert('Error generating PDF. Please try again.');
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
    } catch (error) {
      console.error("Error submitting reimbursement:", error)
      alert("Error submitting reimbursement. Please try again.")
    }
  }




  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reimbursement?")) return
    try {
      await robustFetch(`${BACKEND_URL}/reimbursement/${id}`, { method: "DELETE" })
if (employee) await loadReimbursements(employee.employeeID)
    } catch (error) {
      console.error("Error deleting reimbursement:", error)
      alert("Error deleting reimbursement. Please try again.")
    }
  }

  const handleEdit = (r: Reimbursement) => {
    setEditing(r)
    setFormData(prev => ({
      ...prev,
      date: r.date || new Date().toISOString().split('T')[0],
      status: "Pending", // Reset to Pending when editing
    }))
    setItems(r.items || [{ reimbursementType: "", amount: "", description: "" }])
    setIsDialogOpen(true)
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
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reimbursement Management</h1>
          <p className="text-gray-600 mt-2">Manage your reimbursement requests</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsDialogOpen(true); }} 
          className="bg-gray-900 hover:bg-gray-800 px-6 py-2 rounded-lg shadow-sm"
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
                placeholder="Search your reimbursements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 py-2 rounded-lg border-gray-300 focus:border-blue-500"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Stats Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-800">{filteredReimbursements.length}</div>
              <div className="text-sm text-blue-600 mt-1">Your Reimbursements</div>
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
                <TableRow className="bg-gray-50 hover:bg-gray-50">
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
                {filteredReimbursements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No reimbursements found. Create your first reimbursement request.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReimbursements.map((r) => {
                    const totalAmount = getTotalAmount(r)
                    return (
                      <TableRow key={r.id} className="hover:bg-gray-50 border-b border-gray-100">
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
                            {/* Download PDF - Available for all statuses */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => generatePDF(r)}
                              className="h-8 w-8 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg"
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>

                            {/* Edit/Delete - Only for non-approved reimbursements */}
                            {r.status !== "Approved" && r.status !== "Paid" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(r)}
                                  className="h-8 w-8 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg"
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
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b bg-white sticky top-0 z-10">
            <DialogTitle className="text-xl font-semibold">
              {editing ? "Edit Reimbursement" : "Create New Reimbursement"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Auto-populated Organization Info (Read-only) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">Company</Label>
                  <Input 
                    type="text" 
                    value={formData.companyName || ""} 
                    readOnly 
                    className="bg-gray-100 border-gray-300"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">Branch</Label>
                  <Input 
                    type="text" 
                    value={formData.branchName || ""} 
                    readOnly 
                    className="bg-gray-100 border-gray-300"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">Employee</Label>
                  <Input 
                    type="text" 
                    value={formData.employeeName || ""} 
                    readOnly 
                    className="bg-gray-100 border-gray-300"
                  />
                </div>

                {/* Date */}
                <div className="space-y-3">
                  <Label htmlFor="date" className="text-sm font-medium text-gray-700">
                    Date *
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
                    <Plus className="w-4 h-4 mr-2" />
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
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-gray-50 sticky bottom-0">
            <div className="flex gap-3 w-full">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="flex-1 border-gray-300 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={handleSubmit}
                className="flex-1 bg-gray-900 hover:bg-gray-800 rounded-lg"
              >
                {editing ? "Update Reimbursement" : "Create Reimbursement"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden PDF Template */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={pdfRef}>
          {reimbursements[0] && <PDFTemplate reimbursement={reimbursements[0]} />}
        </div>
      </div>
    </div>
  )
}