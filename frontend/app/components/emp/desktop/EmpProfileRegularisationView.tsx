"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarCheck2,
  Clock,
  RotateCcw,
} from "lucide-react";

import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/utils/cn";

import {
  EmpTeamStyleDataSection,
  useTeamListControls,
} from "./EmpTeamStyleDataSection";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "/backend";

type RegularisationRow = {
  id: number | string;

  serviceProviderID?: number | null;
  companyID?: number | null;
  branchesID?: number | null;
  departmentID?: number | null;

  manageEmployeeID?: number | null;

  attendanceDate?: string | null;
  day?: string | null;

  checkInTime?: string | null;
  checkOutTime?: string | null;

  actualStatus?: string | null;
  requestedStatus?: string | null;

  reason?: string | null;
  remarks?: string | null;

  status?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;

  isDeleted?: boolean | null;
};

type StoredUser = {
  id?: number;
  userID?: number;
  employeeID?: number;

  employee?: {
    id?: number;
  };

  manageEmployee?: {
    id?: number;
  };
};

/*
 * ============================================================
 * AUTH
 * ============================================================
 */

function authHeaders(): HeadersInit {
  if (
    typeof window ===
    "undefined"
  ) {
    return {};
  }

  const token =
    localStorage.getItem(
      "token",
    ) ||
    localStorage.getItem(
      "accessToken",
    ) ||
    "";

  return {
    Accept:
      "application/json",

    ...(token
      ? {
          Authorization:
            `Bearer ${token}`,
        }
      : {}),

    /*
     * Prevent old regularisation list
     * being reused by proxy/browser.
     */
    "Cache-Control":
      "no-cache, no-store, must-revalidate",

    Pragma:
      "no-cache",
  };
}

/*
 * ============================================================
 * EMPLOYEE RESOLUTION
 * ============================================================
 */

function resolveLoggedEmployeeID():
  | number
  | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      localStorage.getItem(
        "user",
      );

    if (!raw) {
      return null;
    }

    const user =
      JSON.parse(
        raw,
      ) as StoredUser;

    /*
     * Support the common user structures
     * used across your frontend.
     */
    const possibleIDs = [
      user?.employee?.id,
      user?.manageEmployee?.id,
      user?.employeeID,
    ];

    for (
      const value
      of possibleIDs
    ) {
      const id =
        Number(value);

      if (
        Number.isInteger(id) &&
        id > 0
      ) {
        return id;
      }
    }
  } catch (
    error
  ) {
    console.error(
      "Unable to resolve employee from localStorage:",
      error,
    );
  }

  return null;
}

/*
 * ============================================================
 * FORMATTING
 * ============================================================
 */

/*
 * Attendance Date is a DATE.
 *
 * Do NOT convert its UTC value directly because
 * timezone conversion can shift the displayed day.
 */
function formatAttendanceDate(
  value?: string | null,
): string {
  if (!value) {
    return "—";
  }

  const dateOnly =
    String(value)
      .slice(0, 10);

  const parts =
    dateOnly.split("-");

  if (
    parts.length !== 3
  ) {
    return dateOnly;
  }

  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const day =
    Number(parts[2]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return dateOnly;
  }

  /*
   * Construct local calendar date.
   * Noon protects against DST/date boundary issues.
   */
  const date =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return dateOnly;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      weekday:
        "short",

      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    },
  );
}

/*
 * Your backend stores time-only values as something like:
 *
 * 2000-01-01T04:30:00.000Z
 *
 * We only want to display:
 *
 * 10:00 AM
 */
function formatTime(
  value?: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return date.toLocaleTimeString(
    "en-IN",
    {
      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        true,
    },
  );
}

function formatEnumLabel(
  value?: string | null,
): string {
  if (!value) {
    return "—";
  }

  return String(value)
    .trim()
    .replace(
      /_/g,
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function normalizeStatus(
  value?: string | null,
): string {
  return String(
    value ||
    "Pending",
  )
    .trim()
    .toLowerCase();
}

function displayStatus(
  status?: string | null,
): string {
  const normalized =
    normalizeStatus(
      status,
    );

  if (
    normalized ===
    "regularized"
  ) {
    return "Approved";
  }

  return (
    normalized
      .charAt(0)
      .toUpperCase() +
    normalized.slice(1)
  );
}

function statusBadgeClass(
  status?: string | null,
): string {
  const normalized =
    normalizeStatus(
      status,
    );

  if (
    normalized ===
      "approved" ||
    normalized ===
      "regularized"
  ) {
    return [
      "border-emerald-200",
      "bg-emerald-50",
      "text-emerald-700",
      "dark:border-emerald-900",
      "dark:bg-emerald-950/40",
      "dark:text-emerald-400",
    ].join(" ");
  }

  if (
    normalized ===
    "rejected"
  ) {
    return [
      "border-red-200",
      "bg-red-50",
      "text-red-700",
      "dark:border-red-900",
      "dark:bg-red-950/40",
      "dark:text-red-400",
    ].join(" ");
  }

  return [
    "border-amber-200",
    "bg-amber-50",
    "text-amber-700",
    "dark:border-amber-900",
    "dark:bg-amber-950/40",
    "dark:text-amber-400",
  ].join(" ");
}

/*
 * ============================================================
 * CARD
 * ============================================================
 */

function RegularisationCard({
  row,
}: {
  row:
    RegularisationRow;
}) {
  const hasTime =
    Boolean(
      row.checkInTime ||
      row.checkOutTime,
    );

  const actualStatus =
    formatEnumLabel(
      row.actualStatus,
    );

  const requestedStatus =
    formatEnumLabel(
      row.requestedStatus,
    );

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        "rounded-xl border border-border",
        "bg-card p-4",
        "sm:flex-row sm:items-center",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0",
            "items-center justify-center",
            "rounded-md",
            "bg-sky-500/10",
            "text-sky-600",
          )}
        >
          <RotateCcw className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {formatAttendanceDate(
              row.attendanceDate,
            )}
          </p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {[
              row.day ||
                null,

              row.actualStatus
                ? `Was: ${actualStatus}`
                : null,

              row.requestedStatus
                ? `Requested: ${requestedStatus}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") ||
              "Attendance regularisation"}
          </p>

          {hasTime && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5 shrink-0" />

              <span>
                {formatTime(
                  row.checkInTime,
                )}

                {" → "}

                {formatTime(
                  row.checkOutTime,
                )}
              </span>
            </p>
          )}

          {row.reason ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {row.reason}
            </p>
          ) : null}
        </div>
      </div>

      <Badge
        variant="outline"
        className={cn(
          "w-fit shrink-0",
          statusBadgeClass(
            row.status,
          ),
        )}
      >
        <CalendarCheck2 className="mr-1 size-3.5" />

        {displayStatus(
          row.status,
        )}
      </Badge>
    </div>
  );
}

/*
 * ============================================================
 * EMPLOYEE REGULARISATION VIEW
 * ============================================================
 */

export function EmpProfileRegularisationView({
  employeeId:
    viewEmployeeId,
}: {
  employeeId?: number;
} = {}) {
  const [
    rows,
    setRows,
  ] =
    useState<
      RegularisationRow[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    employeeId,
    setEmployeeId,
  ] =
    useState<
      number | null
    >(
      viewEmployeeId ??
      null,
    );

  const {
    viewMode,
    selectViewMode,
    searchQuery,
    setSearchQuery,
  } =
    useTeamListControls(
      viewEmployeeId
        ? `emp-team-regularisation-view-${viewEmployeeId}`
        : "emp-profile-regularisation-view",
    );

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState(
      "all",
    );

  /*
   * ============================================================
   * LOAD
   * ============================================================
   */

  const load =
    useCallback(
      async (
        signal?: AbortSignal,
      ) => {
        setLoading(
          true,
        );

        try {
          /*
           * Manager/team view:
           * use provided employee ID.
           *
           * Employee profile:
           * use logged-in employee ID.
           */
          const empId =
            viewEmployeeId ??
            resolveLoggedEmployeeID();

          setEmployeeId(
            empId,
          );

          if (
            !empId
          ) {
            setRows(
              [],
            );

            return;
          }

          /*
           * Cache-busting timestamp is intentional.
           *
           * If records were deleted in another page/session,
           * this forces the employee tab to request fresh DB data.
           */
          const url =
            `${BACKEND}/emp-attendance-regularise?_=${Date.now()}`;

          const response =
            await fetch(
              url,
              {
                method:
                  "GET",

                headers:
                  authHeaders(),

                cache:
                  "no-store",

                signal,
              },
            );

          if (
            !response.ok
          ) {
            const message =
              await response
                .text()
                .catch(
                  () =>
                    "",
                );

            throw new Error(
              message ||
              `Unable to load regularisations (${response.status})`,
            );
          }

          const payload =
            await response.json();

          const allRows:
            RegularisationRow[] =
            Array.isArray(
              payload,
            )
              ? payload
              : [];

          /*
           * ====================================================
           * IMPORTANT SECURITY/UI FILTER
           * ====================================================
           *
           * Employee Profile shows ONLY the selected employee's
           * records.
           *
           * Never rely only on the frontend route/page to decide
           * which employee records should be rendered.
           */
          const employeeRows =
            allRows.filter(
              (
                row,
              ) => {
                const rowEmployeeID =
                  Number(
                    row.manageEmployeeID,
                  );

                return (
                  Number.isInteger(
                    rowEmployeeID,
                  ) &&
                  rowEmployeeID ===
                    Number(
                      empId,
                    ) &&
                  row.isDeleted !==
                    true
                );
              },
            );

          /*
           * Defensive de-duplication by regularisation record ID.
           *
           * This does NOT hide legitimate separate requests.
           * It only protects against the same API object being
           * accidentally returned/merged twice.
           */
          const uniqueRows =
            Array.from(
              new Map(
                employeeRows.map(
                  (
                    row,
                  ) => [
                    String(
                      row.id,
                    ),
                    row,
                  ],
                ),
              ).values(),
            );

          /*
           * Latest created request first.
           *
           * Fall back to numeric ID when createdAt is unavailable.
           */
          uniqueRows.sort(
            (
              left,
              right,
            ) => {
              const leftCreated =
                left.createdAt
                  ? new Date(
                      left.createdAt,
                    ).getTime()
                  : 0;

              const rightCreated =
                right.createdAt
                  ? new Date(
                      right.createdAt,
                    ).getTime()
                  : 0;

              if (
                leftCreated &&
                rightCreated &&
                leftCreated !==
                  rightCreated
              ) {
                return (
                  rightCreated -
                  leftCreated
                );
              }

              return (
                Number(
                  right.id,
                ) -
                Number(
                  left.id,
                )
              );
            },
          );

          /*
           * Replace existing state completely.
           *
           * NEVER:
           * setRows(prev => [...prev, ...employeeRows])
           *
           * Otherwise deleted records can remain visually stale.
           */
          setRows(
            uniqueRows,
          );
        } catch (
          error
        ) {
          if (
            error instanceof
              DOMException &&
            error.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Failed to load employee regularisations:",
            error,
          );

          setRows(
            [],
          );
        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(
              false,
            );
          }
        }
      },
      [
        viewEmployeeId,
      ],
    );

  useEffect(
    () => {
      const controller =
        new AbortController();

      void load(
        controller.signal,
      );

      return () => {
        controller.abort();
      };
    },
    [
      load,
    ],
  );

  /*
   * Refresh when the user returns to this tab/window.
   *
   * Useful when a regularisation was deleted/approved
   * in another browser tab.
   */
  useEffect(
    () => {
      const handleFocus =
        () => {
          void load();
        };

      window.addEventListener(
        "focus",
        handleFocus,
      );

      return () => {
        window.removeEventListener(
          "focus",
          handleFocus,
        );
      };
    },
    [
      load,
    ],
  );

  /*
   * ============================================================
   * FILTERING
   * ============================================================
   */

  const filtered =
    useMemo(
      () => {
        const query =
          searchQuery
            .trim()
            .toLowerCase();

        return rows.filter(
          (
            row,
          ) => {
            const status =
              normalizeStatus(
                row.status,
              );

            if (
              statusFilter !==
                "all" &&
              status !==
                statusFilter
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            const searchValues =
              [
                row.attendanceDate,
                row.day,
                row.actualStatus,
                row.requestedStatus,
                row.reason,
                row.remarks,
                row.status,

                formatEnumLabel(
                  row.actualStatus,
                ),

                formatEnumLabel(
                  row.requestedStatus,
                ),

                displayStatus(
                  row.status,
                ),
              ];

            const haystack =
              searchValues
                .filter(
                  Boolean,
                )
                .join(
                  " ",
                )
                .toLowerCase();

            return haystack.includes(
              query,
            );
          },
        );
      },
      [
        rows,
        searchQuery,
        statusFilter,
      ],
    );

  /*
   * ============================================================
   * VIEWS
   * ============================================================
   */

  const listContent = (
    <div className="space-y-2">
      {filtered.map(
        (
          row,
        ) => (
          <RegularisationCard
            key={
              String(
                row.id,
              )
            }
            row={
              row
            }
          />
        ),
      )}
    </div>
  );

  const gridContent = (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map(
        (
          row,
        ) => (
          <RegularisationCard
            key={
              String(
                row.id,
              )
            }
            row={
              row
            }
          />
        ),
      )}
    </div>
  );

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <EmpTeamStyleDataSection
      title="Regularisation requests"
      subtitle={
        viewEmployeeId
          ? "Attendance regularisation days for this team member"
          : "Your attendance regularisation days and request status"
      }
      searchQuery={
        searchQuery
      }
      onSearchChange={
        setSearchQuery
      }
      searchPlaceholder="Search regularisations…"
      filterContent={
        <>
          {[
            {
              id:
                "all",

              label:
                "All",
            },

            {
              id:
                "pending",

              label:
                "Pending",
            },

            {
              id:
                "approved",

              label:
                "Approved",
            },

            {
              id:
                "rejected",

              label:
                "Rejected",
            },
          ].map(
            (
              option,
            ) => (
              <button
                key={
                  option.id
                }
                type="button"
                onClick={() =>
                  setStatusFilter(
                    option.id,
                  )
                }
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",

                  statusFilter ===
                    option.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {
                  option.label
                }
              </button>
            ),
          )}
        </>
      }
      viewMode={
        viewMode
      }
      onViewModeChange={
        selectViewMode
      }
      loading={
        loading
      }
      empty={
        !loading &&
        (
          !employeeId ||
          filtered.length ===
            0
        )
      }
      emptyMessage={
        !employeeId
          ? "Unable to resolve employee profile."
          : "No regularisation requests."
      }
      listContent={
        listContent
      }
      gridContent={
        gridContent
      }
    />
  );
}