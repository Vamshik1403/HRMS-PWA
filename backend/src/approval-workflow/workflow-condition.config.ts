export const WORKFLOW_CONDITION_CONFIG = {

  EMPLOYEE_ONBOARDING_MODULE: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
    ],
  },
   REIMBURSEMENT_MODULE: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'TOTAL_AMOUNT',
    ],
  },

  LEAVE_MODULE: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'LEAVE_TYPE',
      'LEAVE_DAYS',
    ],
  },

   PAYROLL_MODULE: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'SALARY_AMOUNT',
    ],
  },

  OFF_BOARDING_MODULE: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'EXIT_TYPE',
    ],
  },

  ATTENDANCE_MODULE: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'REGULARISATION_TYPE',
      'REGULARISATION_DAYS',
    ],
  },
  
  SALARY_MANAGEMENT: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'SALARY_AMOUNT',
    ],
  },

  REIMBURSEMENT: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'TOTAL_AMOUNT',
    ],
  },

  LEAVE_MANAGEMENT: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'LEAVE_TYPE',
      'LEAVE_DAYS',
    ],
  },

  OFF_BOARDING: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'EXIT_TYPE',
    ],
  },

  ATTENDANCE_REGULARISATION: {
    fields: [
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'REGULARISATION_TYPE',
      'REGULARISATION_DAYS',
    ],
  },
} as const;

export const CONDITION_OPERATOR_CONFIG = {
  DEPARTMENT: ['EQUALS', 'NOT_EQUALS'],
  DESIGNATION: ['EQUALS', 'NOT_EQUALS'],
  EMPLOYEE: ['IN', 'NOT_IN'],

  TOTAL_AMOUNT: [
    'EQUALS',
    'NOT_EQUALS',
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN',
    'LESS_THAN_OR_EQUAL',
    'BETWEEN',
  ],

  SALARY_AMOUNT: [
    'EQUALS',
    'NOT_EQUALS',
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN',
    'LESS_THAN_OR_EQUAL',
    'BETWEEN',
  ],

  LEAVE_TYPE: ['EQUALS', 'NOT_EQUALS', 'IN'],
  LEAVE_DAYS: [
    'EQUALS',
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN',
    'LESS_THAN_OR_EQUAL',
    'BETWEEN',
  ],

  EXIT_TYPE: ['EQUALS', 'NOT_EQUALS', 'IN'],

  REGULARISATION_TYPE: [
    'EQUALS',
    'NOT_EQUALS',
    'IN',
  ],

  REGULARISATION_DAYS: [
    'EQUALS',
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN',
    'LESS_THAN_OR_EQUAL',
    'BETWEEN',
  ],

  REQUEST_TEXT: [
    'EQUALS',
    'NOT_EQUALS',
    'CONTAINS',
    'NOT_CONTAINS',
  ],
} as const;