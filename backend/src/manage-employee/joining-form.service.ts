import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

type JoiningFormEmployee = {
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  employeeID?: string | null;
  joiningDate?: string | null;
  businessEmail?: string | null;
  personalEmail?: string | null;
  personalPhoneNo?: string | null;
  businessPhoneNo?: string | null;
  presentAddress?: string | null;
  permenantAddress?: string | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;
  aadharNo?: string | null;
  panNo?: string | null;
  uanNo?: string | null;
  esiNo?: string | null;
  pfNumber?: string | null;
  pfMemberStatus?: string | null;
  emergancyContact?: string | null;
  employeeFatherName?: string | null;
  employeeMotherName?: string | null;
  employeeSpouseName?: string | null;
  departments?: { departmentName?: string | null } | null;
  designations?: { designation?: string | null } | null;
  company?: { companyName?: string | null } | null;
  monthlyPayGrade?: { grossSalary?: string | null; monthlyPayGradeName?: string | null } | null;
  employeeBankDetails?: {
    bankName?: string | null;
    bankBranchName?: string | null;
    accNumber?: string | null;
    ifscCode?: string | null;
  }[];
  empEduQualification?: { degree?: string | null; class?: string | null; instituteName?: string | null }[];
  empProfExprience?: { orgName?: string | null; designation?: string | null; fromDate?: string | null; toDate?: string | null }[];
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

function txt(v: string | null | undefined): string {
  return (v ?? '').trim();
}

function fullName(emp: JoiningFormEmployee): string {
  return `${emp.employeeFirstName ?? ''} ${emp.employeeLastName ?? ''}`.trim();
}

function contactNo(emp: JoiningFormEmployee): string {
  return txt(emp.personalPhoneNo) || txt(emp.businessPhoneNo);
}

function email(emp: JoiningFormEmployee): string {
  return txt(emp.businessEmail) || txt(emp.personalEmail);
}

function qualification(emp: JoiningFormEmployee): string {
  const edu = emp.empEduQualification ?? [];
  if (!edu.length) return '';
  const best = edu[0];
  return [best.degree, best.class, best.instituteName].filter(Boolean).join(' — ');
}

function previousOrg(emp: JoiningFormEmployee): string {
  const exp = emp.empProfExprience ?? [];
  if (!exp.length) return '';
  const first = exp[0];
  const parts = [first.orgName, first.designation].filter(Boolean) as string[];
  if (first.fromDate || first.toDate) {
    parts.push(`(${first.fromDate ?? ''} – ${first.toDate ?? ''})`);
  }
  return parts.join(' ');
}

function pfEsiLine(emp: JoiningFormEmployee): string {
  const parts: string[] = [];
  if (txt(emp.uanNo)) parts.push(`UAN: ${txt(emp.uanNo)}`);
  if (txt(emp.pfNumber)) parts.push(`PF: ${txt(emp.pfNumber)}`);
  if (txt(emp.esiNo)) parts.push(`ESIC: ${txt(emp.esiNo)}`);
  if (txt(emp.pfMemberStatus)) parts.push(txt(emp.pfMemberStatus));
  return parts.join(' · ');
}

function grossSalary(emp: JoiningFormEmployee): string {
  return txt(emp.monthlyPayGrade?.grossSalary) || txt(emp.monthlyPayGrade?.monthlyPayGradeName);
}

type FamilyRow = { name: string; relation: string; dob: string; contact: string };

function familyRows(emp: JoiningFormEmployee): FamilyRow[] {
  const rows: FamilyRow[] = [];
  if (txt(emp.employeeFatherName)) {
    rows.push({ name: txt(emp.employeeFatherName), relation: 'Father', dob: '', contact: '' });
  }
  if (txt(emp.employeeMotherName)) {
    rows.push({ name: txt(emp.employeeMotherName), relation: 'Mother', dob: '', contact: '' });
  }
  if (txt(emp.employeeSpouseName)) {
    rows.push({ name: txt(emp.employeeSpouseName), relation: 'Spouse', dob: '', contact: '' });
  }
  while (rows.length < 2) {
    rows.push({ name: '', relation: '', dob: '', contact: '' });
  }
  return rows.slice(0, 4);
}

function wrapLines(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

class PdfLayout {
  private y: number;
  private page: PDFPage;

  constructor(
    private readonly pdfDoc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  private ensureSpace(needed: number) {
    if (this.y - needed >= MARGIN) return;
    this.page = this.pdfDoc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  private drawText(text: string, x: number, yPos: number, size: number, f: PDFFont) {
    this.page.drawText(text, { x, y: yPos, size, font: f, color: rgb(0, 0, 0) });
  }

  sectionTitle(title: string) {
    this.ensureSpace(22);
    this.y -= 8;
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 12,
      width: CONTENT_W,
      height: 14,
      color: rgb(0.9, 0.91, 0.92),
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: 0.5,
    });
    this.drawText(title.toUpperCase(), MARGIN + 4, this.y - 9, 8, this.bold);
    this.y -= 18;
  }

  gridRow(cells: { label: string; value: string }[], cols = 2) {
    const colW = CONTENT_W / cols;
    const labelW = colW * 0.32;
    const valueW = colW - labelW - 8;
    const size = 8;
    let rowH = 16;

    const valueLines: string[][] = [];
    for (const c of cells) {
      valueLines.push(wrapLines(c.value, valueW, this.font, size));
    }
    rowH = Math.max(rowH, ...valueLines.map((l) => l.length * 11 + 6));

    this.ensureSpace(rowH + 4);
    let x = MARGIN;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const lines = valueLines[i];
      const h = Math.max(16, lines.length * 11 + 6);
      this.page.drawRectangle({
        x,
        y: this.y - h,
        width: colW,
        height: h,
        borderColor: rgb(0.2, 0.2, 0.2),
        borderWidth: 0.5,
      });
      this.drawText(c.label, x + 3, this.y - 10, size, this.bold);
      let vy = this.y - 10;
      for (const line of lines) {
        this.drawText(line, x + labelW, vy, size, this.font);
        vy -= 11;
      }
      x += colW;
    }
    this.y -= rowH + 1;
  }

  fullWidthBlock(label: string, value: string) {
    const size = 8;
    const lines = wrapLines(value, CONTENT_W - 90, this.font, size);
    const h = Math.max(28, lines.length * 11 + 14);
    this.ensureSpace(h + 4);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - h,
      width: CONTENT_W,
      height: h,
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: 0.5,
    });
    this.drawText(label, MARGIN + 3, this.y - 10, size, this.bold);
    let vy = this.y - 10;
    for (const line of lines) {
      this.drawText(line, MARGIN + 88, vy, size, this.font);
      vy -= 11;
    }
    this.y -= h + 2;
  }

  familyTable(rows: FamilyRow[]) {
    const cols = [28, 120, 70, 80, 90, 55];
    const headers = ['Sr.', 'Name', 'Relation', 'DOB', 'Contact', 'Dep. Y/N'];
    const headerH = 16;
    const rowH = 14;
    const totalH = headerH + rows.length * rowH;

    this.ensureSpace(totalH + 6);
    let x = MARGIN;
    for (let i = 0; i < headers.length; i++) {
      this.page.drawRectangle({
        x,
        y: this.y - headerH,
        width: cols[i],
        height: headerH,
        color: rgb(0.93, 0.94, 0.95),
        borderColor: rgb(0.2, 0.2, 0.2),
        borderWidth: 0.5,
      });
      this.drawText(headers[i], x + 2, this.y - 11, 7, this.bold);
      x += cols[i];
    }
    this.y -= headerH;

    rows.forEach((row, idx) => {
      x = MARGIN;
      const vals = [
        String(idx + 1),
        row.name,
        row.relation,
        row.dob,
        row.contact,
        '',
      ];
      for (let i = 0; i < vals.length; i++) {
        this.page.drawRectangle({
          x,
          y: this.y - rowH,
          width: cols[i],
          height: rowH,
          borderColor: rgb(0.2, 0.2, 0.2),
          borderWidth: 0.5,
        });
        this.drawText(vals[i].slice(0, 40), x + 2, this.y - 10, 7, this.font);
        x += cols[i];
      }
      this.y -= rowH;
    });
    this.y -= 4;
  }

  signatures() {
    this.ensureSpace(70);
    this.y -= 10;
    const boxW = (CONTENT_W - 20) / 2;
    for (let i = 0; i < 2; i++) {
      const x = MARGIN + i * (boxW + 20);
      this.page.drawLine({
        start: { x, y: this.y - 40 },
        end: { x: x + boxW, y: this.y - 40 },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
      });
      const label = i === 0 ? "Candidate's Signature" : 'HR Signature';
      this.drawText(label, x, this.y - 12, 8, this.bold);
      this.drawText('(manual)', x, this.y - 22, 7, this.font);
    }
    this.y -= 50;
  }

  header(companyName: string) {
    const title = companyName || 'Company Name';
    const w = this.bold.widthOfTextAtSize(title, 13);
    this.drawText(title, (PAGE_W - w) / 2, this.y, 13, this.bold);
    this.y -= 16;
    const sub = 'JOINING FORM';
    const sw = this.bold.widthOfTextAtSize(sub, 11);
    this.drawText(sub, (PAGE_W - sw) / 2, this.y, 11, this.bold);
    this.y -= 8;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 1,
      color: rgb(0.1, 0.1, 0.1),
    });
    this.y -= 14;
  }
}

@Injectable()
export class JoiningFormService {
  async generatePdf(emp: JoiningFormEmployee): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const layout = new PdfLayout(pdfDoc, font, bold);

    const companyName = txt(emp.company?.companyName) || 'Company Name';
    const bank = emp.employeeBankDetails?.[0];
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    layout.header(companyName);
    layout.gridRow([
      { label: 'Date', value: today },
      { label: 'Employee Code', value: txt(emp.employeeID) },
    ]);
    layout.gridRow([
      { label: 'Designation', value: txt(emp.designations?.designation) },
      { label: 'Department', value: txt(emp.departments?.departmentName) },
    ]);
    layout.gridRow([
      { label: 'Name', value: fullName(emp) },
      { label: 'Email ID', value: email(emp) },
    ]);

    layout.sectionTitle('Present Address');
    layout.fullWidthBlock('', txt(emp.presentAddress));
    layout.sectionTitle('Permanent Address');
    layout.fullWidthBlock('', txt(emp.permenantAddress));

    layout.sectionTitle('Personal Details');
    layout.gridRow([
      { label: 'Date of Birth', value: txt(emp.dateOfBirth) },
      { label: 'Contact', value: contactNo(emp) },
    ]);
    layout.gridRow([
      { label: 'Qualification', value: qualification(emp) },
      { label: 'Blood Group', value: txt(emp.bloodGroup) },
    ]);
    layout.gridRow([
      { label: 'Marital Status', value: txt(emp.maritalStatus) },
      { label: 'Marriage Date', value: '' },
    ]);
    layout.gridRow([
      { label: 'PAN', value: txt(emp.panNo) },
      { label: 'Aadhaar', value: txt(emp.aadharNo) },
    ]);
    layout.gridRow([
      { label: 'Passport', value: '' },
      { label: 'Driving Licence', value: '' },
    ]);
    layout.fullWidthBlock('Emergency Contact', txt(emp.emergancyContact));

    layout.sectionTitle('Family Details');
    layout.familyTable(familyRows(emp));

    layout.sectionTitle('Bank Details');
    layout.gridRow([
      { label: 'Bank Name', value: txt(bank?.bankName) },
      { label: 'IFSC', value: txt(bank?.ifscCode) },
    ]);
    layout.gridRow([
      { label: 'Account No.', value: txt(bank?.accNumber) },
      { label: 'Branch', value: txt(bank?.bankBranchName) },
    ]);

    layout.sectionTitle('Previous Organization');
    layout.fullWidthBlock('', previousOrg(emp));

    layout.gridRow([
      { label: 'PF / UAN / ESIC', value: pfEsiLine(emp) },
      { label: 'Reference', value: '' },
    ]);
    layout.fullWidthBlock('Approved By', '');

    layout.sectionTitle('Salary Details');
    layout.gridRow([
      { label: 'Gross Salary', value: grossSalary(emp) },
      { label: 'Date of Joining', value: txt(emp.joiningDate) },
    ]);

    layout.signatures();

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }
}
