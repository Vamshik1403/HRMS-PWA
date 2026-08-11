export const WORKFLOW_CONDITION_CONFIG = {
  EMPLOYEE_ONBOARDING_MODULE: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
    ],
  },

  REIMBURSEMENT_MODULE: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'TOTAL_AMOUNT',
    ],
  },

  LEAVE_MODULE: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'LEAVE_TYPE',
      'LEAVE_DAYS',
    ],
  },

  PAYROLL_MODULE: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'SALARY_AMOUNT',
    ],
  },

  OFF_BOARDING_MODULE: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'EXIT_TYPE',
    ],
  },

  ATTENDANCE_MODULE: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'REGULARISATION_TYPE',
      'REGULARISATION_DAYS',
    ],
  },

  /*
   * Legacy keys retained so existing CompanyModules
   * records continue to work.
   */
  SALARY_MANAGEMENT: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'SALARY_AMOUNT',
    ],
  },

  REIMBURSEMENT: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'TOTAL_AMOUNT',
    ],
  },

  LEAVE_MANAGEMENT: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'LEAVE_TYPE',
      'LEAVE_DAYS',
    ],
  },

  OFF_BOARDING: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'EXIT_TYPE',
    ],
  },

  ATTENDANCE_REGULARISATION: {
    fields: [
      'BRANCH',
      'DEPARTMENT',
      'DESIGNATION',
      'EMPLOYEE',
      'REGULARISATION_TYPE',
      'REGULARISATION_DAYS',
    ],
  },
} as const;

export const CONDITION_OPERATOR_CONFIG = {
  DEPARTMENT: [
    'EQUALS',
    'NOT_EQUALS',
  ],

  DESIGNATION: [
    'EQUALS',
    'NOT_EQUALS',
  ],

  EMPLOYEE: [
    'IN',
    'NOT_IN',
  ],

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

  LEAVE_TYPE: [
    'EQUALS',
    'NOT_EQUALS',
    'CONTAINS',
    'NOT_CONTAINS',
  ],

  LEAVE_DAYS: [
    'EQUALS',
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN',
    'LESS_THAN_OR_EQUAL',
    'BETWEEN',
  ],

  EXIT_TYPE: [
    'EQUALS',
    'NOT_EQUALS',
    'CONTAINS',
    'NOT_CONTAINS',
  ],

  REGULARISATION_TYPE: [
    'EQUALS',
    'NOT_EQUALS',
    'CONTAINS',
    'NOT_CONTAINS',
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

export type WorkflowModuleKey =
  keyof typeof WORKFLOW_CONDITION_CONFIG;

export type WorkflowConditionField =
  typeof WORKFLOW_CONDITION_CONFIG[
    WorkflowModuleKey
  ]['fields'][number];

export type ConditionOperatorKey =
  keyof typeof CONDITION_OPERATOR_CONFIG;