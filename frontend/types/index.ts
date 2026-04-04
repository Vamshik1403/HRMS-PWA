// Employee Types
export interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  department: string
  position: string
  hireDate: string
  salary: number
  status: 'active' | 'inactive' | 'terminated'
  avatar?: string
  address?: string
  emergencyContact?: string
}

// Attendance Types
export interface Attendance {
  id: string
  employeeId: string
  employee: Employee
  checkIn: string
  checkOut?: string
  totalHours?: number
  status: 'present' | 'absent' | 'late' | 'half-day'
  date: string
  notes?: string
}

// Leave Types
export interface LeaveRequest {
  id: string
  employeeId: string
  employee: Employee
  leaveType: 'sick' | 'vacation' | 'personal' | 'maternity' | 'paternity' | 'other'
  startDate: string
  endDate: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  appliedDate: string
  approvedBy?: string
  approvedDate?: string
}

// Payroll Types
export interface Payroll {
  id: string
  employeeId: string
  employee: Employee
  month: string
  year: number
  basicSalary: number
  allowances: number
  deductions: number
  netSalary: number
  status: 'pending' | 'processed' | 'paid'
  processedDate?: string
}

// Performance Types
export interface PerformanceReview {
  id: string
  employeeId: string
  employee: Employee
  period: string
  rating: number
  goals: string[]
  achievements: string[]
  areasForImprovement: string[]
  reviewerId: string
  reviewDate: string
  status: 'draft' | 'submitted' | 'approved'
}

// Recruitment Types
export interface JobPosting {
  id: string
  title: string
  department: string
  description: string
  requirements: string[]
  location: string
  salaryRange: {
    min: number
    max: number
  }
  postedDate: string
  deadline: string
  status: 'open' | 'closed' | 'draft'
  applicants: number
}

// Training Types
export interface TrainingProgram {
  id: string
  title: string
  description: string
  instructor: string
  startDate: string
  endDate: string
  participants: string[]
  status: 'upcoming' | 'ongoing' | 'completed'
  materials?: string[]
}

// Awards Types
export interface Award {
  id: string
  awardName: string
  employeeId: string
  employee: Employee
  department: string
  category: 'performance' | 'innovation' | 'teamwork' | 'leadership'
  awardDate: string
  description: string
  presentedBy: string
}

// Notice Types
export interface Notice {
  id: string
  title: string
  description: string
  publishedDate: string
  publishedBy: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'active' | 'expired' | 'draft'
  expiryDate?: string
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Form Types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea'
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
}

// Dashboard Types
export interface DashboardStats {
  totalEmployees: number
  totalDepartments: number
  presentToday: number
  absentToday: number
  pendingLeaves: number
  upcomingTrainings: number
}
