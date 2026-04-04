import axios from 'axios'

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// API endpoints
export const endpoints = {
  // Auth
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    register: '/auth/register',
    refresh: '/auth/refresh',
  },
  
  // Employees
  employees: {
    list: '/employees',
    create: '/employees',
    get: (id: string) => `/employees/${id}`,
    update: (id: string) => `/employees/${id}`,
    delete: (id: string) => `/employees/${id}`,
  },
  
  // Attendance
  attendance: {
    list: '/attendance',
    create: '/attendance',
    get: (id: string) => `/attendance/${id}`,
    update: (id: string) => `/attendance/${id}`,
    delete: (id: string) => `/attendance/${id}`,
    checkIn: '/attendance/check-in',
    checkOut: '/attendance/check-out',
  },
  
  // Leave
  leave: {
    list: '/leave',
    create: '/leave',
    get: (id: string) => `/leave/${id}`,
    update: (id: string) => `/leave/${id}`,
    delete: (id: string) => `/leave/${id}`,
    approve: (id: string) => `/leave/${id}/approve`,
    reject: (id: string) => `/leave/${id}/reject`,
  },
  
  // Payroll
  payroll: {
    list: '/payroll',
    create: '/payroll',
    get: (id: string) => `/payroll/${id}`,
    update: (id: string) => `/payroll/${id}`,
    delete: (id: string) => `/payroll/${id}`,
    process: '/payroll/process',
  },
  
  // Performance
  performance: {
    list: '/performance',
    create: '/performance',
    get: (id: string) => `/performance/${id}`,
    update: (id: string) => `/performance/${id}`,
    delete: (id: string) => `/performance/${id}`,
  },
  
  // Recruitment
  recruitment: {
    list: '/recruitment',
    create: '/recruitment',
    get: (id: string) => `/recruitment/${id}`,
    update: (id: string) => `/recruitment/${id}`,
    delete: (id: string) => `/recruitment/${id}`,
  },
  
  // Training
  training: {
    list: '/training',
    create: '/training',
    get: (id: string) => `/training/${id}`,
    update: (id: string) => `/training/${id}`,
    delete: (id: string) => `/training/${id}`,
  },
  
  // Awards
  awards: {
    list: '/awards',
    create: '/awards',
    get: (id: string) => `/awards/${id}`,
    update: (id: string) => `/awards/${id}`,
    delete: (id: string) => `/awards/${id}`,
  },
  
  // Notice
  notice: {
    list: '/notice',
    create: '/notice',
    get: (id: string) => `/notice/${id}`,
    update: (id: string) => `/notice/${id}`,
    delete: (id: string) => `/notice/${id}`,
  },
  
  // Dashboard
  dashboard: {
    stats: '/dashboard/stats',
    recentActivity: '/dashboard/activity',
  },
}

export default api
