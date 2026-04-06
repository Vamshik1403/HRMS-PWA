# OpenHRM Dashboard — Product Spec & Engineering Brief

> **Date:** 2026-04-05 · **Status:** Draft · **Audience:** Design + Engineering

---

## 1. Product Summary & Value Proposition

OpenHRM is a multi-tenant HRMS dashboard that gives HR admins and managers a single-glance view of workforce health — headcount, attendance, department coverage, and employee activity — scoped by role so each user sees only what they own. **The primary value proposition is reducing the daily "attendance audit" from a 15-minute manual export to a 3-second visual check**, with real-time punch data, anomaly badges, and drill-through to individual employee timelines.

---

## 2. Prioritised Feature Improvements (8)

| # | Feature | Rationale | Effort |
|---|---------|-----------|--------|
| 1 | **Role-based endpoint guards (backend)** | No `@Roles()` guards exist — any authenticated user can call any endpoint. Critical security gap. | **Med** |
| 2 | **Department column in attendance table** | Currently renders `—` hard-coded. Join `departments` data to employees for meaningful drill-down. | **Low** |
| 3 | **Date picker on Attendance Overview** | Locked to "Last 7 Days" — managers need arbitrary date-range reports for payroll reconciliation. | **Med** |
| 4 | **Real-time punch WebSocket push** | Dashboard polls on mount only. Live punch events via existing `attlog-listener` would keep counts current. | **High** |
| 5 | **CSV / Excel export** | No export path today. Add `xlsx`-based export on Today Attendance table (leveraging SheetJS — see attached format diagrams). | **Low** |
| 6 | **Empty-state illustrations + onboarding** | "No employees found" is a dead-end. Show CTA to import employees or connect a device. | **Low** |
| 7 | **Mobile-responsive attendance table** | Table overflows on `< 640px` with no horizontal scroll indicator. Convert to card layout on mobile. | **Med** |
| 8 | **Notification centre (bell icon is inert)** | Bell icon in navbar has no backing store or dropdown. Wire to audit-log events or leave requests. | **High** |

---

## 3. UI/UX Refinements

### Visual Hierarchy
| Element | Current | Recommended |
|---------|---------|-------------|
| KPI card value | `text-[28px] font-extrabold` | Good — keep. Ensure `tabular-nums` on numbers for alignment. |
| Section headers | `text-xs uppercase tracking-wider` | Bump to `text-[13px]` for readability; keep uppercase + tracking. |
| Table body text | `text-sm` (14 px) | Drop to `text-[13px]` to fit 6 columns without overflow on 1280 px. |
| Donut center number | `text-xl font-extrabold` | Add `font-variant-numeric: tabular-nums` for steadier animation. |

### Spacing & Layout
- **Card gap:** `gap-3` (12 px) is tight on 4-col grid at 1024 px. Use `gap-3 lg:gap-4`.
- **Page padding:** `p-2 sm:p-3` inside `<main>` feels cramped with sidebar collapsed. Use `p-3 sm:p-5` and add `max-w-[1440px] mx-auto` for ultra-wide monitors.
- **Attendance Overview inner grid:** `gap-6` between donut and bar chart is wider than outer gaps. Normalise to `gap-4`.

### Affordance & Interactivity
- KPI cards have `hover:-translate-y-0.5` but no `cursor-pointer` and no click target. Either make them link to detail pages or remove the lift animation.
- Status badges (`Present` / `Absent`) should be filterable — click to filter the table.
- Progress bars on KPI cards lack `role="progressbar"` and `aria-valuenow`.

### Accessibility
| Issue | Fix |
|-------|-----|
| Colour contrast on `text-[10px] text-gray-400` labels | Fails WCAG AA (3.2:1). Use `text-gray-500` (#6b7280 → 4.6:1). |
| Donut chart is canvas-only — no text alternative | Add `aria-label="Present: 42 of 100 employees"` on SVG. |
| No visible focus ring on sidebar links | Add `focus-visible:ring-2 focus-visible:ring-[#2F80ED] focus-visible:ring-offset-2` |
| No skip-to-content link | Add hidden anchor before sidebar targeting `#main-content`. |
| Keyboard shortcut hints | Add `Ctrl+K` for search bar, `Ctrl+/` for sidebar toggle. Document in `?` modal. |

### Mobile Breakpoints
| Breakpoint | Behaviour |
|------------|-----------|
| `< 640px` | Stack KPI cards 1-col. Attendance table → card list. Sidebar auto-collapsed via `SidebarProvider defaultOpen={false}`. |
| `640–1024px` | KPI 2-col. Attendance overview stacks donut above bar chart. |
| `> 1024px` | Current 4-col KPI + 3:1 split. |
| `> 1440px` | Cap content at `max-w-[1440px]`. |

---

## 4. Microcopy Guide

| UI Element | Current Copy | Recommended Copy |
|------------|-------------|-----------------|
| **Dashboard header** | `Dashboard Overview` | **Welcome back, {firstName}** — *Here's your workforce pulse for today.* |
| **Total Employees card** | `Total Employees` / `All-time` | `Total Headcount` / `Active roster` |
| **Present card** | `Present` / `Today` | `Checked In` / `As of {HH:mm}` |
| **Absent card** | `Absent` / `Today` | `Not Yet In` / `Expected today` |
| **Attendance Overview header** | `ATTENDANCE OVERVIEW` | `WEEKLY ATTENDANCE TREND` |
| **KPI widgets** | `Productivity Rate`, `Attendance Rate` | `Productivity Score` / `Punctuality Rate` — clearer what's measured |
| **Today Attendance row empty** | `No employees found` | `No employees match your current scope. Check your branch and company filters, or contact your admin.` |
| **Activity feed empty** | `No recent activities` | `It's quiet here. Activities like check-ins, leave requests, and approvals will show up as they happen.` |
| **Upgrade CTA (sidebar)** | `Upgrade Plan` | `Unlock Advanced Reports →` |
| **Notification badge** | *(none — bell is inert)* | Show red dot with count: `3 new` — tooltip: `3 pending leave requests` |

---

## 5. Acceptance Criteria & Success Metrics

### Acceptance Criteria
1. **AC-1:** Dashboard loads all KPI cards, chart, table, and activity feed within **2 seconds** on a 3G Fast connection (Lighthouse performance ≥ 80).
2. **AC-2:** SUPERADMIN sees all employees across all companies; MANAGER sees only their `companyID` + `branchesID`; EMPLOYEE sees only their own record. Verified by integration tests.
3. **AC-3:** Attendance table correctly resolves department name (not `—`) for ≥ 95% of employees with a valid `departmentsID` foreign key.
4. **AC-4:** All interactive elements are reachable via keyboard (Tab order matches visual order) and colour contrast ≥ 4.5:1 on text.
5. **AC-5:** CSV export produces a valid `.xlsx` file containing all visible columns with correct UTF-8 encoding for non-Latin names.

### Measurable Success Metrics
| Metric | Baseline | Target (90 days) | Measurement |
|--------|----------|-------------------|-------------|
| **Daily dashboard engagement** (unique sessions/day) | — | ≥ 70% of active admin users | PostHog / Mixpanel page-view event |
| **Attendance logging rate** (employees with ≥ 1 punch / working day) | — | ≥ 92% | Backend query: `COUNT(DISTINCT employeeID) / active employees` |
| **Time to first insight** (page load → first interaction) | ~4 s | ≤ 2 s | Lighthouse TTI + RUM `first-click` event |
| **Export adoption** | 0 | ≥ 30 exports / week across tenants | Track `dashboard.export.clicked` event |
| **Error rate** (4xx/5xx on dashboard API calls) | ~3% | < 0.5% | Backend access-log aggregation |

---

## 6. API Specification

### Attendance Record – JSON Schema

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AttendanceRecord",
  "type": "object",
  "required": ["id", "employeeID", "punchTimeStamp", "direction"],
  "properties": {
    "id":              { "type": "integer", "description": "Auto-increment PK" },
    "employeeID":      { "type": "integer", "description": "FK → Employee.id" },
    "serviceProviderID": { "type": "integer" },
    "companyID":       { "type": "integer" },
    "branchesID":      { "type": "integer" },
    "punchTimeStamp":  { "type": "string", "format": "date-time", "description": "ISO 8601 UTC" },
    "direction":       { "type": "string", "enum": ["IN", "OUT"], "description": "Punch direction" },
    "deviceID":        { "type": ["integer", "null"], "description": "FK → Device.id" },
    "source":          { "type": "string", "enum": ["BIOMETRIC", "MANUAL", "MOBILE", "IMPORT"], "default": "BIOMETRIC" },
    "createdAt":       { "type": "string", "format": "date-time" },
    "updatedAt":       { "type": "string", "format": "date-time" }
  }
}
```

### Example API Endpoint

```
GET /emp-attendance-logs/dashboard-summary?date=2026-04-05&companyID=1&branchesID=2
```

| Field | Value |
|-------|-------|
| **Method** | `GET` |
| **Path** | `/emp-attendance-logs/dashboard-summary` |
| **Auth** | `Authorization: Bearer <JWT>` — scopes: `attendance:read` |
| **Query Params** | `date` (ISO date, required), `companyID` (int, optional — SUPERADMIN only), `branchesID` (int, optional) |
| **Request Body** | None |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "date": "2026-04-05",
    "totalEmployees": 142,
    "presentCount": 128,
    "absentCount": 14,
    "departments": 8,
    "weeklyTrend": [
      { "day": "Mon", "present": 130, "absent": 12, "total": 142 },
      { "day": "Tue", "present": 128, "absent": 14, "total": 142 }
    ],
    "employees": [
      {
        "employeeID": 42,
        "name": "Priya Sharma",
        "department": "Engineering",
        "inTime": "09:02",
        "outTime": null,
        "status": "PRESENT"
      }
    ]
  }
}
```

**Response `403 Forbidden`** (scope violation):
```json
{ "success": false, "error": "Insufficient scope: attendance:read required" }
```

---

## 7. Role-Based Access Matrix

| Resource / Action | SUPERADMIN | ADMIN | MANAGER | EMPLOYEE |
|-------------------|:----------:|:-----:|:-------:|:--------:|
| View all companies' dashboards | ✅ | ❌ | ❌ | ❌ |
| View own company dashboard | ✅ | ✅ | ✅ | ❌ |
| View own branch attendance | ✅ | ✅ | ✅ | ❌ |
| View own attendance record | ✅ | ✅ | ✅ | ✅ |
| Export attendance CSV | ✅ | ✅ | ✅ | ❌ |
| Edit employee records | ✅ | ✅ | ❌ | ❌ |
| Manage devices | ✅ | ✅ | ❌ | ❌ |
| Regularise attendance | ✅ | ✅ | ✅ (own branch) | ✅ (self, needs approval) |
| View KPI / reports | ✅ | ✅ | ✅ (scoped) | ❌ |
| System settings (roles, billing) | ✅ | ❌ | ❌ | ❌ |

### Required Security Controls

| Control | Implementation |
|---------|---------------|
| **Auth scopes** | Encode `attendance:read`, `employee:write`, `admin:*` in JWT claims. Validate via NestJS `@RequireScopes()` guard. |
| **Role guard** | Add `RolesGuard` + `@Roles(UserRole.MANAGER, ...)` decorator to every controller. Currently **missing** — top priority. |
| **Row-level scoping** | MANAGER queries **must** filter by `companyID` + `branchesID` from JWT payload. EMPLOYEE queries **must** filter by `employeeID`. Never trust client-sent IDs for scoping. |
| **Audit logging** | Log every `GET /dashboard-summary`, `POST /attendance`, `PATCH /employee` to an append-only `audit_logs` table: `{ userId, action, resource, timestamp, ip }`. |
| **Rate limiting** | 100 req / min per user on dashboard endpoints. Use `@nestjs/throttler`. |
| **GDPR data retention** | Attendance PII retained for **24 months** (configurable per tenant). Automated purge job runs monthly. Employee can request data export via `/me/data-export`. Right-to-erasure anonymises name + identifiers but retains aggregated counts. |
| **Transport security** | HTTPS-only in production. Set `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options: DENY`. |
| **Token hygiene** | JWT expiry: 1 day (current). Add refresh-token rotation (7-day sliding window). Revoke on password change. |

---

## 8. A/B Tests

| # | Test | Variant A (Control) | Variant B | Primary KPI | Target Lift |
|---|------|--------------------:|-----------|-------------|-------------|
| 1 | **KPI card click-through** | Cards are static (current) | Cards link to detail pages (`/manage-employees`, `/departments`) | Click-through rate on KPI cards | +25% engagement in 30 days |
| 2 | **Attendance table default sort** | Chronological (by employee #) | Absent-first sort (surfaces anomalies) | Time from dashboard load to first regularisation action | −40% time-to-action |
| 3 | **Upgrade CTA placement** | Bottom of sidebar only | Sidebar + inline banner after KPI section ("Unlock team analytics →") | Upgrade page visit rate | +15% visit rate in 14 days |

---

## 9. Implementation Roadmap

### Milestone 1 — Security & Data Integrity (Weeks 1–3)
- [ ] Add `RolesGuard` + `@Roles()` decorators to all backend controllers
- [ ] Implement JWT scope claims (`attendance:read`, `employee:write`, `admin:*`)
- [ ] Row-level tenant scoping: verify all Prisma queries filter by `companyID`/`branchesID` from JWT
- [ ] Add `audit_logs` table + middleware for write operations
- [ ] Wire department names into dashboard attendance table (resolve the `—` column)
- [ ] Add `@nestjs/throttler` rate limiting

### Milestone 2 — Feature Completeness (Weeks 4–7)
- [ ] Build dedicated `/emp-attendance-logs/dashboard-summary` endpoint (single API call replaces 3 current fetches)
- [ ] Add date-range picker to Attendance Overview section
- [ ] Implement CSV/XLSX export using SheetJS (`xlsx` package)
- [ ] Build notification dropdown (backed by leave-request + audit events)
- [ ] Add WebSocket push for live punch updates via existing `attlog-listener`
- [ ] Empty-state illustrations + onboarding flow for new tenants

### Milestone 3 — Polish & Measurement (Weeks 8–10)
- [ ] Accessibility audit: focus rings, skip link, ARIA labels, contrast fixes
- [ ] Mobile card layout for attendance table at `< 640px`
- [ ] Integrate analytics events (PostHog/Mixpanel) for all success metrics
- [ ] Run A/B tests #1 and #2
- [ ] Performance budget: Lighthouse ≥ 80, TTI ≤ 2 s
- [ ] GDPR data-retention cron job + `/me/data-export` endpoint
- [ ] Documentation: API reference (OpenAPI 3.1), component storybook entries

---

*End of spec. All recommendations are grounded in the current codebase at `hrms-latest-main` as of 2026-04-05.*
