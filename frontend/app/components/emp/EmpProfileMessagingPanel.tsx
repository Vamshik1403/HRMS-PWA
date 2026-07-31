"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  AtSign,
  Check,
  CheckCheck,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  SendHorizontal,
  Smile,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { useMemoChatPolling } from "@/app/hooks/useMemoChatPolling";
import { authHeaders } from "@/lib/auth";
import { useEmpPortalPageHeader } from "@/app/components/layout/emp-portal-page-context";
import { reporteeDisplayName } from "@/app/utils/empManagerDisplay";
import { resolveAttachmentUrl, uploadAttachmentFile } from "@/app/utils/uploadFile";
import { getPageCache, setPageCache } from "@/app/utils/pageCache";
import { getSidebarContext } from "@/app/utils/sidebarContext";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
/** Synthetic self id for admin users who are not linked to an employee row. */
const ADMIN_SELF_ID = -1;
type PresenceStatus = "online" | "away" | "offline" | "busy";
type ConversationFilter = "all" | "unread" | "archived";

type MemoRecipient = {
  id: number;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  employeeID?: string | null;
};

type MemoReply = {
  id: number;
  description?: string | null;
  issuedBy?: string | null;
  createdAt?: string | null;
  senderEmployeeId?: number | null;
  attachmentPath?: string | null;
};

type MemoItem = {
  id: number;
  subject?: string | null;
  title?: string | null;
  description?: string | null;
  memoType?: string | null;
  createdAt?: string | null;
  issuedDate?: string | null;
  issuedBy?: string | null;
  senderEmployeeId?: number | null;
  employeeID?: number | null;
  employeeIDs?: number[];
  attachmentPath?: string | null;
  recipients?: MemoRecipient[];
  manageEmployee?: {
    id?: number;
    departmentName?: string | null;
    designation?: string | null;
    employeeFirstName?: string | null;
    employeeLastName?: string | null;
    employeePhotoUrl?: string | null;
  };
  replies?: MemoReply[];
};

type EmployeeProfile = {
  id: number;
  name: string;
  designation: string;
  department: string;
  photoUrl?: string | null;
  isCheckedIn?: boolean;
};

type ChatBubble = {
  id: number;
  threadMemoId: number;
  text: string;
  isOutgoing: boolean;
  senderName: string;
  createdAt: string | null;
  attachmentPath?: string | null;
};

type Conversation = {
  key: string;
  kind: "dm" | "group";
  employeeId: number | null;
  groupId: string | null;
  groupName: string | null;
  memberIds: number[];
  profile: EmployeeProfile;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  memoIds: number[];
  isArchived: boolean;
};

const GROUP_SUBJECT_PREFIX = "IM_GROUP::";

function dmConversationKey(employeeId: number) {
  return `dm:${employeeId}`;
}

function groupConversationKey(groupId: string) {
  return `group:${groupId}`;
}

function parseGroupSubject(subject: string | null | undefined): { groupId: string; groupName: string } | null {
  if (!subject?.startsWith(GROUP_SUBJECT_PREFIX)) return null;
  const rest = subject.slice(GROUP_SUBJECT_PREFIX.length);
  const sep = rest.indexOf("::");
  if (sep <= 0) return null;
  const groupId = rest.slice(0, sep).trim();
  const groupName = rest.slice(sep + 2).trim();
  if (!groupId || !groupName) return null;
  return { groupId, groupName };
}

function encodeGroupSubject(groupId: string, groupName: string) {
  return `${GROUP_SUBJECT_PREFIX}${groupId}::${groupName.trim()}`;
}

function isGroupMemo(memo: MemoItem) {
  return parseGroupSubject(memo.subject) != null;
}

function createGroupId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type TeamMemberRow = {
  id: number;
  employeeID?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  employeePhotoUrl?: string | null;
  designation?: string | null;
  department?: string | null;
  departmentName?: string | null;
  isCheckedIn?: boolean;
};

type SelfProfile = {
  id: number | null;
  employeeCode: string | null;
  fullName: string | null;
};

type ImPanelCache = {
  employeeId: number;
  messages: MemoItem[];
  teamMembers: TeamMemberRow[];
  departmentLabel: string;
  selfProfile: SelfProfile;
};

const IM_PANEL_CACHE_KEY = "empImPanel";
const IM_ADMIN_PANEL_CACHE_KEY = "adminImPanel";

function isSelfEmployee(
  member: Pick<TeamMemberRow, "id" | "employeeID" | "employeeFirstName" | "employeeLastName">,
  self: SelfProfile,
): boolean {
  const memberId = normalizeId(member.id);
  if (self.id != null && memberId === self.id) return true;

  const memberCode = member.employeeID?.trim().toLowerCase();
  const selfCode = self.employeeCode?.trim().toLowerCase();
  if (selfCode && memberCode && selfCode === memberCode) return true;

  const memberName = reporteeDisplayName(member).trim().toLowerCase();
  const selfName = self.fullName?.trim().toLowerCase();
  if (selfName && memberName && selfName === memberName) return true;

  return false;
}

function isSelfConversation(employeeId: number | null | undefined, self: SelfProfile): boolean {
  const id = normalizeId(employeeId);
  if (id == null) return false;
  if (self.id != null && id === self.id) return true;
  return false;
}

function normalizePersonName(name: string | null | undefined) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Prefer a single ACTIVE teammate when duplicate names exist in the contact list. */
function dedupeTeamMembersByName(members: TeamMemberRow[]): TeamMemberRow[] {
  const byName = new Map<string, TeamMemberRow>();
  for (const member of members) {
    const id = normalizeId(member.id);
    if (!id) continue;
    const name = normalizePersonName(reporteeDisplayName(member));
    const key = name || `id:${id}`;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...member, id });
      continue;
    }
    // Keep the higher id when names collide (newer ACTIVE rows tend to have higher ids).
    if (id > (normalizeId(existing.id) ?? 0)) {
      byName.set(key, { ...member, id });
    }
  }
  return [...byName.values()];
}

function readStorageKey(empId: number) {
  return `im-read-${empId}`;
}

function archiveStorageKey(empId: number) {
  return `im-archived-${empId}`;
}

function loadIdSet(key: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return new Set(Array.isArray(JSON.parse(raw || "[]")) ? JSON.parse(raw || "[]") : []);
  } catch {
    return new Set();
  }
}

function saveIdSet(key: string, ids: Set<number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify([...ids]));
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function messagePreview(m: MemoItem) {
  return (m.description || m.subject || m.title || "No message").trim();
}

function memoTimestamp(m: MemoItem | MemoReply) {
  return m.createdAt || ("issuedDate" in m ? m.issuedDate : null) || null;
}

function formatListTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (msgDay.getTime() === today.getTime()) return time;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatBubbleTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function formatDateSeparator(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function presenceFromProfile(profile: EmployeeProfile): PresenceStatus {
  if (profile.isCheckedIn === true) return "online";
  if (profile.isCheckedIn === false) return "offline";
  const modes: PresenceStatus[] = ["online", "away", "offline", "busy"];
  return modes[profile.id % modes.length];
}

function presenceColor(status: PresenceStatus) {
  if (status === "online") return "bg-emerald-500";
  if (status === "away") return "bg-amber-500";
  if (status === "busy") return "bg-blue-500";
  return "bg-gray-400";
}

function presenceLabel(status: PresenceStatus) {
  if (status === "online") return "Online";
  if (status === "away") return "Away";
  if (status === "busy") return "Busy";
  return "Offline";
}

function attachmentKind(path: string) {
  const lower = path.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return "image";
  if (/\.(pdf)$/.test(lower)) return "pdf";
  if (/\.(xlsx?|csv)$/.test(lower)) return "excel";
  if (/\.(docx?)$/.test(lower)) return "word";
  if (/\.(zip|rar|7z)$/.test(lower)) return "zip";
  return "file";
}

function normalizeId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Safe JSON parse for APIs that return HTTP 200 with an empty body (e.g. admin credentials). */
async function readJsonOrNull(res: Response): Promise<any | null> {
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function memoRecipientIds(memo: MemoItem): number[] {
  const ids =
    memo.employeeIDs && memo.employeeIDs.length > 0
      ? memo.employeeIDs
      : memo.employeeID != null
        ? [memo.employeeID]
        : [];
  return ids.map(normalizeId).filter((id): id is number => id != null);
}

function isGeneralMemo(memo: { memoType?: string | null; undoneAt?: string | null }) {
  if (memo.undoneAt) return false;
  const type = (memo.memoType || "General").trim().toLowerCase();
  return type === "general";
}

function counterpartId(memo: MemoItem, selfId: number): number | null {
  const self = normalizeId(selfId);
  if (!self) return null;

  const senderId = normalizeId(memo.senderEmployeeId);
  const recipients = memoRecipientIds(memo);

  if (senderId != null) {
    if (senderId === self) {
      const recipient = recipients.find((id) => id !== self);
      return recipient ?? null;
    }
    return senderId;
  }

  if (recipients.includes(self)) {
    const other = recipients.find((id) => id !== self);
    if (other) return other;
  }

  const primaryEmployeeId = normalizeId(memo.employeeID);
  if (primaryEmployeeId != null && primaryEmployeeId !== self) {
    return primaryEmployeeId;
  }

  return null;
}

function resolveCounterpart(
  memo: MemoItem,
  selfId: number,
  nameToEmployeeId: Map<string, number>,
): number | null {
  const direct = counterpartId(memo, selfId);
  if (direct != null) return direct;

  const self = normalizeId(selfId);
  if (!self) return null;

  const recipients = memoRecipientIds(memo);
  const isIncoming =
    normalizeId(memo.senderEmployeeId) !== self &&
    (recipients.includes(self) || normalizeId(memo.employeeID) === self);

  if (!isIncoming) return null;

  const issuedBy = memo.issuedBy?.trim().toLowerCase();
  if (!issuedBy) return null;

  for (const [name, id] of nameToEmployeeId) {
    if (id === self) continue;
    if (name === issuedBy || name.includes(issuedBy) || issuedBy.includes(name)) {
      return id;
    }
  }

  return null;
}

/**
 * If a memo points at an EXITED/duplicate employee id, fold it onto the ACTIVE
 * teammate that shares the same display name in the current contact list.
 */
function remapCounterpartToActiveTeam(
  counterpart: number | null,
  memo: MemoItem,
  teamIds: Set<number>,
  nameToTeamId: Map<string, number>,
): number | null {
  if (counterpart == null) return null;
  if (teamIds.has(counterpart)) return counterpart;

  const recipient = memo.recipients?.find((row) => normalizeId(row.id) === counterpart);
  const recipientName = normalizePersonName(
    [recipient?.employeeFirstName, recipient?.employeeLastName].filter(Boolean).join(" "),
  );
  if (recipientName) {
    const mapped = nameToTeamId.get(recipientName);
    if (mapped) return mapped;
  }

  const manageName = normalizePersonName(
    [memo.manageEmployee?.employeeFirstName, memo.manageEmployee?.employeeLastName]
      .filter(Boolean)
      .join(" "),
  );
  if (manageName && normalizeId(memo.employeeID) === counterpart) {
    const mapped = nameToTeamId.get(manageName);
    if (mapped) return mapped;
  }

  return counterpart;
}

function profileFromTeamMember(member: TeamMemberRow, fallbackDepartment = "Your Team"): EmployeeProfile {
  return {
    id: member.id,
    name: reporteeDisplayName(member),
    designation: member.designation?.trim() || "Team Member",
    department: member.department?.trim() || member.departmentName?.trim() || fallbackDepartment,
    photoUrl: member.employeePhotoUrl,
    isCheckedIn: member.isCheckedIn,
  };
}

function profileFromRecipient(r: MemoRecipient): EmployeeProfile {
  const name =
    [r.employeeFirstName, r.employeeLastName].filter(Boolean).join(" ").trim() ||
    r.employeeID ||
    `Employee #${r.id}`;
  return {
    id: r.id,
    name,
    designation: "Team Member",
    department: "—",
  };
}

function profileFromManageEmployee(m: MemoItem["manageEmployee"], fallbackId: number): EmployeeProfile {
  const name =
    [m?.employeeFirstName, m?.employeeLastName].filter(Boolean).join(" ").trim() ||
    `Employee #${fallbackId}`;
  return {
    id: m?.id ?? fallbackId,
    name,
    designation: m?.designation?.trim() || "Team Member",
    department: m?.departmentName?.trim() || "—",
    photoUrl: m?.employeePhotoUrl,
  };
}

function ConversationAvatar({
  profile,
  size = "md",
  showPresence = true,
  isGroup = false,
}: {
  profile: EmployeeProfile;
  size?: "sm" | "md" | "lg";
  showPresence?: boolean;
  isGroup?: boolean;
}) {
  const presence = presenceFromProfile(profile);
  const sizeClass = size === "lg" ? "size-11" : size === "sm" ? "size-10" : "size-10";
  const textClass = size === "lg" ? "text-sm" : "text-xs";

  if (isGroup) {
    return (
      <div className="relative shrink-0">
        <div
          className={cn(
            sizeClass,
            "flex items-center justify-center rounded-full bg-primary/10 text-primary",
          )}
        >
          <Users className={size === "lg" ? "size-5" : "size-4"} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      {profile.photoUrl ? (
        <img
          src={profile.photoUrl}
          alt={profile.name}
          className={cn(sizeClass, "rounded-full object-cover bg-[#EEF2F7]")}
        />
      ) : (
        <div
          className={cn(
            sizeClass,
            "flex items-center justify-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary",
            textClass,
          )}
        >
          {initialsFromName(profile.name)}
        </div>
      )}
      {showPresence ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white",
            presenceColor(presence),
          )}
          title={presenceLabel(presence)}
        />
      ) : null}
    </div>
  );
}

function AttachmentPreview({ path }: { path: string }) {
  const url = resolveAttachmentUrl(path);
  const kind = attachmentKind(path);
  const fileName = path.split("/").pop() || "Attachment";

  if (kind === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block overflow-hidden rounded-xl">
        <img src={url} alt={fileName} className="max-h-48 w-full object-cover" />
      </a>
    );
  }

  const label =
    kind === "pdf"
      ? "PDF Document"
      : kind === "excel"
        ? "Excel Spreadsheet"
        : kind === "word"
          ? "Word Document"
          : kind === "zip"
            ? "ZIP Archive"
            : "Attachment";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-[#EEF2F7] bg-white px-3 py-2 text-[13px] font-medium text-primary transition-colors duration-150 hover:bg-[#F8F9FC]"
    >
      <Paperclip className="size-4 shrink-0" />
      <span className="truncate">{fileName || label}</span>
    </a>
  );
}

export function EmpProfileMessagingPanel({
  active = true,
  variant = "employee",
}: {
  active?: boolean;
  /** employee = team/dept contacts; admin = company-wide contacts (COMPANY_ADMIN, SUPERADMIN, etc.) */
  variant?: "employee" | "admin";
} = {}) {
  const user = useCurrentUser();
  const { scope, isManagerView } = useEmpManagerScope();
  const isAdminVariant = variant === "admin";
  /** Company-wide directory only for the admin IM shell; employee portal stays team/dept scoped. */
  const isCompanyScope = isAdminVariant;
  const panelCacheKey = isAdminVariant ? IM_ADMIN_PANEL_CACHE_KEY : IM_PANEL_CACHE_KEY;
  const [messages, setMessages] = useState<MemoItem[]>([]);
  const [threads, setThreads] = useState<Record<number, MemoReply[]>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [departmentLabel, setDepartmentLabel] = useState(
    isCompanyScope ? "All employees" : "Your Team",
  );  const [loading, setLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [selfProfile, setSelfProfile] = useState<SelfProfile>({
    id: null,
    employeeCode: null,
    fullName: null,
  });
  const [senderContext, setSenderContext] = useState<{
    companyID?: number | null;
    branchesID?: number | null;
    serviceProviderID?: number | null;
  }>({});
  const [managerName, setManagerName] = useState("Manager");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    if (document.documentElement.getAttribute("data-emp-layout") === "mobile") return true;
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([]);
  const [groupMemberSearch, setGroupMemberSearch] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hydratedRef = useRef(false);

  const canCompose = Boolean(employeeId) || isCompanyScope;

  const issuedByRoleLabel = useMemo(() => {
    if (isManagerView) return "MANAGER";
    if (user?.role === "COMPANY_ADMIN") return "COMPANY_ADMIN";
    if (user?.role === "BRANCH_ADMIN") return "BRANCH_ADMIN";
    if (user?.role === "SUPERADMIN") return "SUPERADMIN";
    if (user?.role === "SERVICE_PROVIDER") return "SERVICE_PROVIDER";
    return "EMPLOYEE";
  }, [isManagerView, user?.role]);

  const persistPanelCache = useCallback(
    (payload: {
      employeeId: number;
      messages: MemoItem[];
      teamMembers: TeamMemberRow[];
      departmentLabel: string;
      selfProfile: SelfProfile;
    }) => {
      setPageCache(panelCacheKey, payload);
    },
    [panelCacheKey],
  );

  const mergeTeamMember = useCallback(
    (map: Map<number, TeamMemberRow>, member: TeamMemberRow, self: SelfProfile) => {
      if (isSelfEmployee(member, self)) return;
      const memberId = normalizeId(member.id);
      if (!memberId) return;
      const existing = map.get(memberId);
      map.set(memberId, {
        id: memberId,
        employeeID: member.employeeID ?? existing?.employeeID,
        employeeFirstName: member.employeeFirstName ?? existing?.employeeFirstName,
        employeeLastName: member.employeeLastName ?? existing?.employeeLastName,
        employeePhotoUrl: member.employeePhotoUrl ?? existing?.employeePhotoUrl,
        designation: member.designation ?? existing?.designation,
        department: member.department ?? existing?.department,
        departmentName: member.departmentName ?? existing?.departmentName,
        isCheckedIn: member.isCheckedIn ?? existing?.isCheckedIn,
      });
    },
    [],
  );

  const loadTeamContacts = useCallback(
    async (forEmployeeId?: number, selfOverride?: SelfProfile, options?: { silent?: boolean }) => {
      const targetId = normalizeId(forEmployeeId ?? employeeId);
      const self = selfOverride ?? selfProfile;
      if (!targetId) {
        setTeamMembers([]);
        setTeamLoading(false);
        return;
      }

      if (!options?.silent) {
        setTeamLoading((current) => current || teamMembers.length === 0);
      }
      try {
      const headers = authHeaders();
      const [teamRes, reporteesRes, colleaguesRes, credsRes] = await Promise.all([
        fetch(`${BACKEND}/emp-manager-scope/team-today-status?scope=team`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${BACKEND}/emp-manager-scope/reportees-today-status`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${BACKEND}/emp-manager-scope/delegation-colleagues`, {
          headers,
          cache: "no-store",
        }),
        user?.username
          ? fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`, {
              headers,
              cache: "no-store",
            })
          : Promise.resolve(null),
      ]);

      const teamData = teamRes.ok ? await teamRes.json() : null;
      const reporteesData = reporteesRes.ok ? await reporteesRes.json() : null;
      const colleaguesData = colleaguesRes.ok ? await colleaguesRes.json() : null;
      const creds = credsRes && "ok" in credsRes && credsRes.ok ? await credsRes.json() : null;

      const deptName =
        creds?.employee?.departments?.departmentName ||
        creds?.employee?.department ||
        creds?.employee?.departmentName ||
        "Your Team";
      setDepartmentLabel(deptName);

      const byId = new Map<number, TeamMemberRow>();
      const teamList = Array.isArray(teamData?.members) ? teamData.members : [];
      const reporteeList = Array.isArray(reporteesData?.reportees) ? reporteesData.reportees : [];
      const colleagueList = Array.isArray(colleaguesData?.colleagues) ? colleaguesData.colleagues : [];

      teamList.forEach((member: TeamMemberRow) => mergeTeamMember(byId, member, self));
      reporteeList.forEach((member: TeamMemberRow) => mergeTeamMember(byId, member, self));
      scope?.reportees.forEach((member) => {
        mergeTeamMember(
          byId,
          {
            id: member.id,
            employeeID: member.employeeID,
            employeeFirstName: member.employeeFirstName,
            employeeLastName: member.employeeLastName,
          },
          self,
        );
      });

      colleagueList.forEach(
        (colleague: {
          id: number;
          employeeID?: string;
          name?: string;
          employeePhotoUrl?: string | null;
        }) => {
          const nameParts = (colleague.name || "").trim().split(/\s+/).filter(Boolean);
          mergeTeamMember(
            byId,
            {
              id: colleague.id,
              employeeID: colleague.employeeID,
              employeeFirstName: nameParts[0],
              employeeLastName: nameParts.slice(1).join(" "),
              employeePhotoUrl: colleague.employeePhotoUrl,
              departmentName: deptName,
            },
            self,
          );
        },
      );

      const merged = dedupeTeamMembersByName(
        [...byId.values()]
          .filter((member) => !isSelfEmployee(member, self))
          .map((member) => ({
            ...member,
            department: member.department || member.departmentName || deptName,
            departmentName: member.departmentName || member.department || deptName,
          })),
      );

      merged.sort((a, b) => reporteeDisplayName(a).localeCompare(reporteeDisplayName(b)));
      setTeamMembers(merged);
    } catch {
      if (!options?.silent) setTeamMembers([]);
    } finally {
      setTeamLoading(false);
    }
  },
    [employeeId, mergeTeamMember, scope?.reportees, selfProfile, teamMembers.length, user?.username],
  );

  const loadCompanyContacts = useCallback(
    async (selfOverride?: SelfProfile, options?: { silent?: boolean; companyID?: number | null }) => {
      const self = selfOverride ?? selfProfile;
      if (!options?.silent) {
        setTeamLoading((current) => current || teamMembers.length === 0);
      }
      try {
        let res = await fetch(`${BACKEND}/manage-emp/list?status=ACTIVE`, {
          cache: "no-store",
        });
        if (!res.ok) {
          res = await fetch(`${BACKEND}/manage-emp`, { cache: "no-store" });
        }
        const raw = await readJsonOrNull(res);
        let all: any[] = Array.isArray(raw) ? raw : raw?.data ?? [];
        if (!Array.isArray(all)) all = [];
        let companyID =
          normalizeId(options?.companyID) ??
          normalizeId(user?.companyID) ??
          null;

        if (!companyID && user?.username) {
          try {
            const usersRes = await fetch(`${BACKEND}/users`, {
              headers: authHeaders(),
              cache: "no-store",
            });
            const usersRaw = await readJsonOrNull(usersRes);
            const users = Array.isArray(usersRaw) ? usersRaw : usersRaw?.data ?? [];
            const me = users.find((u: any) => u.username === user.username);
            companyID = normalizeId(me?.companyID);
          } catch {
            /* ignore */
          }
        }

        const ctx = getSidebarContext();
        if (!companyID) {
          companyID = normalizeId(ctx?.companyID);
        }

        const branchID =
          user?.role === "BRANCH_ADMIN" ? (user?.branchesID ?? null) : null;

        if (companyID) {
          all = all.filter((e: any) => Number(e.companyID) === Number(companyID));
        }
        if (branchID) {
          all = all.filter((e: any) => Number(e.branchesID) === Number(branchID));
        }

        // If company filter wiped everyone but the API returned rows, fall back to unfiltered
        // ACTIVE list (avoids stale sidebar company context hiding real employees).
        if (companyID && all.length === 0) {
          const unfiltered: any[] = Array.isArray(raw) ? raw : raw?.data ?? [];
          if (unfiltered.length > 0) {
            // Keep only rows that share the most common companyID among ACTIVE employees
            // belonging to this admin when possible; otherwise show all ACTIVE.
            const adminCompany = companyID;
            const matching = unfiltered.filter(
              (e: any) => Number(e.companyID) === Number(adminCompany),
            );
            all = matching.length > 0 ? matching : unfiltered;
          }
        }

        setDepartmentLabel(
          user?.role === "BRANCH_ADMIN" ? "Branch employees" : "All employees",
        );

        if (companyID) {
          setSenderContext((prev) => ({
            ...prev,
            companyID: Number(companyID),
          }));
        }

        const byId = new Map<number, TeamMemberRow>();
        all.forEach((emp: any) => {
          const designation =
            emp.designations?.designation ||
            emp.empDesignation?.[0]?.designation?.designation ||
            emp.designation?.designation ||
            (typeof emp.designation === "string" ? emp.designation : null) ||
            "—";
          const department =
            emp.departments?.departmentName ||
            emp.empDepartment?.[0]?.department?.departmentName ||
            emp.departmentName ||
            (typeof emp.department === "string" ? emp.department : null) ||
            "—";

          mergeTeamMember(
            byId,
            {
              id: emp.id,
              employeeID: emp.employeeID,
              employeeFirstName: emp.employeeFirstName,
              employeeLastName: emp.employeeLastName,
              employeePhotoUrl: emp.employeePhotoUrl,
              designation,
              department,
              departmentName: department,
            },
            self,
          );
        });

        const merged = dedupeTeamMembersByName(
          [...byId.values()].filter((member) => !isSelfEmployee(member, self)),
        );
        merged.sort((a, b) => reporteeDisplayName(a).localeCompare(reporteeDisplayName(b)));
        setTeamMembers(merged);
      } catch {
        if (!options?.silent) setTeamMembers([]);
      } finally {
        setTeamLoading(false);
      }
    },
    [mergeTeamMember, selfProfile, teamMembers.length, user?.branchesID, user?.companyID, user?.role, user?.username],
  );

  useEffect(() => {
    const compactMq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => {
      const forceMobile = document.documentElement.getAttribute("data-emp-layout") === "mobile";
      const compact = forceMobile || compactMq.matches;
      setIsCompact(compact);
      if (compact) setSidebarOpen(true);
    };
    onChange();
    compactMq.addEventListener("change", onChange);
    return () => {
      compactMq.removeEventListener("change", onChange);
    };
  }, []);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user?.username) return;
      if (!options?.silent) {
        setLoading((current) => current || (messages.length === 0 && teamMembers.length === 0));
      }
      try {
        const headers = authHeaders();
        const ctx = getSidebarContext();
        // Admin users often have no employee credentials — empty 200 body must not abort load.
        let creds: any = null;
        try {
          const credsRes = await fetch(
            `${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`,
            { headers },
          );
          creds = await readJsonOrNull(credsRes);
        } catch {
          creds = null;
        }
        const empId = normalizeId(creds?.employee?.id);
        const nextSelfProfile: SelfProfile = {
          id: empId,
          employeeCode: creds?.employee?.employeeID?.trim() || null,
          fullName:
            [creds?.employee?.employeeFirstName, creds?.employee?.employeeLastName]
              .filter(Boolean)
              .join(" ")
              .trim() || user.username || null,
        };
        setEmployeeId(empId);
        setSelfProfile(nextSelfProfile);
        const nextSenderContext = {
          companyID:
            normalizeId(
              creds?.companyID ??
                creds?.employee?.companyID ??
                ctx?.companyID ??
                user?.companyID,
            ) ?? undefined,
          branchesID:
            normalizeId(creds?.employee?.branchesID ?? user?.branchesID) ??
            undefined,
          serviceProviderID:
            normalizeId(
              creds?.serviceProviderID ?? ctx?.serviceProviderID ?? user?.serviceProviderID,
            ) ?? undefined,
        };
        // Prefer company from /users when credentials are missing (typical COMPANY_ADMIN).
        if (!nextSenderContext.companyID && user?.username) {
          try {
            const usersRes = await fetch(`${BACKEND}/users`, {
              headers,
              cache: "no-store",
            });
            const usersRaw = await readJsonOrNull(usersRes);
            const users = Array.isArray(usersRaw) ? usersRaw : usersRaw?.data ?? [];
            const me = users.find((u: any) => u.username === user.username);
            const fromUser = normalizeId(me?.companyID);
            if (fromUser) nextSenderContext.companyID = fromUser;
          } catch {
            /* ignore */
          }
        }
        setSenderContext(nextSenderContext);
        setManagerName(nextSelfProfile.fullName || user.username || "Admin");

        const storageKeyId = empId ?? nextSenderContext.companyID ?? ADMIN_SELF_ID;
        setReadIds(loadIdSet(readStorageKey(storageKeyId)));
        setArchivedIds(loadIdSet(archiveStorageKey(storageKeyId)));

        const memoUrl =
          isCompanyScope || !empId
            ? `${BACKEND}/employee-memo`
            : `${BACKEND}/employee-memo?employeeID=${empId}`;
        let list: MemoItem[] = [];
        try {
          const memoRes = await fetch(memoUrl, { headers });
          const data = await readJsonOrNull(memoRes);
          list = (Array.isArray(data) ? data : data?.data ?? []).filter((m: MemoItem) =>
            isGeneralMemo(m),
          );
        } catch {
          list = [];
        }

        if (isCompanyScope && nextSenderContext.companyID) {
          list = list.filter((m: any) => {
            const companyID = m.companyID ?? m.manageEmployee?.companyID;
            return companyID == null || Number(companyID) === Number(nextSenderContext.companyID);
          });
        }

        list.sort(
          (a: MemoItem, b: MemoItem) =>
            new Date(b.createdAt || b.issuedDate || 0).getTime() -
            new Date(a.createdAt || a.issuedDate || 0).getTime(),
        );
        setMessages(list);
        if (list.length === 0 && typeof window !== "undefined" && !isCompanyScope) {
          sessionStorage.removeItem(`_pc_${panelCacheKey}`);
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith("im-read-") || key.startsWith("im-archived-")) {
              localStorage.removeItem(key);
            }
          }
        }

        if (isCompanyScope) {
          await loadCompanyContacts(nextSelfProfile, {
            silent: true,
            companyID: nextSenderContext.companyID ?? null,
          });
        } else if (empId) {
          await loadTeamContacts(empId, nextSelfProfile, { silent: true });
        } else {
          setTeamMembers([]);
        }
      } catch {
        if (!options?.silent) setMessages([]);
        // Still try to load company contacts for admin even if earlier steps failed.
        if (isCompanyScope) {
          try {
            await loadCompanyContacts(undefined, { silent: true });
          } catch {
            /* ignore */
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [
      isCompanyScope,
      loadCompanyContacts,
      loadTeamContacts,
      messages.length,
      teamMembers.length,
      user?.branchesID,
      user?.companyID,
      user?.serviceProviderID,
      user?.username,
    ],
  );

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const cached = getPageCache<ImPanelCache>(panelCacheKey);
    if (!cached) {
      void load();
      return;
    }
    setEmployeeId(cached.employeeId);
    setSelfProfile(cached.selfProfile);
    setMessages(cached.messages);
    setTeamMembers(cached.teamMembers.filter((member) => !isSelfEmployee(member, cached.selfProfile)));
    setDepartmentLabel(cached.departmentLabel);
    setManagerName(cached.selfProfile.fullName || "Manager");
    void load({ silent: true });
  }, [load]);

  useEffect(() => {
    if (!employeeId && !isCompanyScope) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    const interval = window.setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [employeeId, isCompanyScope, load]);

  useEffect(() => {
    const id = normalizeId(employeeId) ?? (isCompanyScope ? senderContext.companyID ?? ADMIN_SELF_ID : null);
    if (id == null || (messages.length === 0 && teamMembers.length === 0)) return;
    persistPanelCache({
      employeeId: id,
      messages,
      teamMembers,
      departmentLabel,
      selfProfile,
    });
  }, [
    departmentLabel,
    employeeId,
    isCompanyScope,
    messages,
    persistPanelCache,
    selfProfile,
    senderContext.companyID,
    teamMembers,
  ]);

  const nameToEmployeeId = useMemo(() => {
    const map = new Map<string, number>();
    teamMembers.forEach((member) => {
      const id = normalizeId(member.id);
      if (!id) return;
      const name = normalizePersonName(reporteeDisplayName(member));
      if (name) map.set(name, id);
    });
    messages.forEach((memo) => {
      const senderId = normalizeId(memo.senderEmployeeId);
      const issuedBy = normalizePersonName(memo.issuedBy);
      // Prefer live team contacts over historical issuedBy name collisions.
      if (senderId && issuedBy && !map.has(issuedBy)) map.set(issuedBy, senderId);
    });
    return map;
  }, [teamMembers, messages]);

  const teamIdSet = useMemo(() => {
    const set = new Set<number>();
    teamMembers.forEach((member) => {
      const id = normalizeId(member.id);
      if (id) set.add(id);
    });
    return set;
  }, [teamMembers]);

  const resolveActiveCounterpart = useCallback(
    (memo: MemoItem, self: number) => {
      const raw = resolveCounterpart(memo, self, nameToEmployeeId);
      return remapCounterpartToActiveTeam(raw, memo, teamIdSet, nameToEmployeeId);
    },
    [nameToEmployeeId, teamIdSet],
  );

  const profileMap = useMemo(() => {
    const map = new Map<number, EmployeeProfile>();
    teamMembers.forEach((member) => {
      const id = normalizeId(member.id);
      if (id) map.set(id, profileFromTeamMember(member, departmentLabel));
    });
    messages.forEach((memo) => {
      const cp = employeeId ? resolveActiveCounterpart(memo, employeeId) : null;
      if (cp && !map.has(cp)) {
        const recipient = memo.recipients?.find((r) => normalizeId(r.id) === cp);
        if (recipient) {
          map.set(cp, profileFromRecipient(recipient));
        } else if (normalizeId(memo.manageEmployee?.id) === cp || normalizeId(memo.employeeID) === cp) {
          map.set(cp, profileFromManageEmployee(memo.manageEmployee, cp));
        }
      }
      memo.recipients?.forEach((r) => {
        const id = normalizeId(r.id);
        if (id && !map.has(id)) map.set(id, profileFromRecipient(r));
      });
    });
    return map;
  }, [teamMembers, departmentLabel, messages, employeeId, resolveActiveCounterpart]);

  const isReceived = useCallback(
    (m: MemoItem) => {
      const self = normalizeId(employeeId);
      if (!self) {
        const issuedBy = normalizePersonName(m.issuedBy);
        const selfName = normalizePersonName(managerName);
        const userName = normalizePersonName(user?.username);
        if ((selfName && issuedBy === selfName) || (userName && issuedBy === userName)) return false;
        return true;
      }
      const senderId = normalizeId(m.senderEmployeeId);
      if (senderId === self) return false;
      const recipients = memoRecipientIds(m);
      if (recipients.includes(self) || normalizeId(m.employeeID) === self) return true;

      // Treat messages sent to EXITED duplicate rows of the logged-in person as received.
      const selfName = normalizePersonName(selfProfile.fullName);
      if (!selfName) return false;
      return Boolean(
        m.recipients?.some((row) => {
          const name = normalizePersonName(
            [row.employeeFirstName, row.employeeLastName].filter(Boolean).join(" "),
          );
          return name === selfName;
        }),
      );
    },
    [employeeId, managerName, selfProfile.fullName, user?.username],
  );

  const isSent = useCallback(
    (m: MemoItem) => {
      const self = normalizeId(employeeId);
      const senderId = normalizeId(m.senderEmployeeId);
      if (self != null && senderId === self) return true;
      if (self != null) return false;
      const issuedBy = normalizePersonName(m.issuedBy);
      const selfName = normalizePersonName(managerName);
      const userName = normalizePersonName(user?.username);
      return Boolean((selfName && issuedBy === selfName) || (userName && issuedBy === userName));
    },
    [employeeId, managerName, user?.username],
  );

  const rowStatus = useCallback(
    (m: MemoItem) => {
      if (archivedIds.has(m.id)) return "Archived" as const;
      if (isReceived(m) && !readIds.has(m.id)) return "Unread" as const;
      return "Read" as const;
    },
    [archivedIds, isReceived, readIds],
  );

  const markRead = useCallback(
    (id: number) => {
      const storageId = employeeId ?? senderContext.companyID ?? ADMIN_SELF_ID;
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveIdSet(readStorageKey(storageId), next);
        return next;
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("emp-sidebar-badges-changed"));
      }
    },
    [employeeId, senderContext.companyID],
  );

  const markArchived = useCallback(
    (id: number) => {
      const storageId = employeeId ?? senderContext.companyID ?? ADMIN_SELF_ID;
      setArchivedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveIdSet(archiveStorageKey(storageId), next);
        return next;
      });
    },
    [employeeId, senderContext.companyID],
  );

  const markUnarchived = useCallback(
    (id: number) => {
      const storageId = employeeId ?? senderContext.companyID ?? ADMIN_SELF_ID;
      setArchivedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        saveIdSet(archiveStorageKey(storageId), next);
        return next;
      });
    },
    [employeeId, senderContext.companyID],
  );

  const conversations = useMemo(() => {
    const self = normalizeId(employeeId) ?? (isCompanyScope ? ADMIN_SELF_ID : null);
    if (self == null) return [] as Conversation[];
    const dmMap = new Map<number, Conversation>();
    const groupMap = new Map<string, Conversation>();

    teamMembers.forEach((member) => {
      const memberId = normalizeId(member.id);
      if (!memberId || isSelfEmployee(member, selfProfile)) return;
      dmMap.set(memberId, {
        key: dmConversationKey(memberId),
        kind: "dm",
        employeeId: memberId,
        groupId: null,
        groupName: null,
        memberIds: [memberId],
        profile: profileFromTeamMember(member, departmentLabel),
        lastMessage: "",
        lastMessageAt: null,
        unreadCount: 0,
        memoIds: [],
        isArchived: false,
      });
    });

    messages.forEach((memo) => {
      const groupMeta = parseGroupSubject(memo.subject);
      if (groupMeta) {
        const memberIds = Array.from(
          new Set(
            [...memoRecipientIds(memo), normalizeId(memo.senderEmployeeId)]
              .filter((id): id is number => id != null && id !== self),
          ),
        );
        const key = groupConversationKey(groupMeta.groupId);
        const existing =
          groupMap.get(key) ||
          ({
            key,
            kind: "group",
            employeeId: null,
            groupId: groupMeta.groupId,
            groupName: groupMeta.groupName,
            memberIds,
            profile: {
              id: 0,
              name: groupMeta.groupName,
              designation: "Group chat",
              department: `${Math.max(memberIds.length, 1) + 1} members`,
            },
            lastMessage: "",
            lastMessageAt: null,
            unreadCount: 0,
            memoIds: [],
            isArchived: false,
          } satisfies Conversation);

        existing.groupName = groupMeta.groupName;
        existing.profile.name = groupMeta.groupName;
        existing.memberIds = Array.from(new Set([...existing.memberIds, ...memberIds]));
        existing.profile.department = `${existing.memberIds.length + 1} members`;
        if (!existing.memoIds.includes(memo.id)) existing.memoIds.push(memo.id);

        const preview = messagePreview(memo);
        const date = memoTimestamp(memo);
        if (
          !existing.lastMessageAt ||
          new Date(date || 0).getTime() > new Date(existing.lastMessageAt).getTime()
        ) {
          existing.lastMessage = preview;
          existing.lastMessageAt = date;
        }
        if (rowStatus(memo) === "Unread") existing.unreadCount += 1;
        existing.isArchived = existing.memoIds.every((id) => archivedIds.has(id));
        groupMap.set(key, existing);
        return;
      }

      const cp = resolveActiveCounterpart(memo, self);
      if (!cp || cp === self || isSelfConversation(cp, selfProfile)) return;

      const profile =
        profileMap.get(cp) ||
        ({
          id: cp,
          name: memo.issuedBy?.trim() || `Employee #${cp}`,
          designation: "Team Member",
          department: memo.manageEmployee?.departmentName?.trim() || "—",
        } satisfies EmployeeProfile);

      const existing =
        dmMap.get(cp) ||
        ({
          key: dmConversationKey(cp),
          kind: "dm",
          employeeId: cp,
          groupId: null,
          groupName: null,
          memberIds: [cp],
          profile,
          lastMessage: "",
          lastMessageAt: null,
          unreadCount: 0,
          memoIds: [],
          isArchived: false,
        } satisfies Conversation);

      if (!existing.memoIds.includes(memo.id)) existing.memoIds.push(memo.id);

      const preview = messagePreview(memo);
      const date = memoTimestamp(memo);
      if (
        !existing.lastMessageAt ||
        new Date(date || 0).getTime() > new Date(existing.lastMessageAt).getTime()
      ) {
        existing.lastMessage = preview;
        existing.lastMessageAt = date;
      }

      if (rowStatus(memo) === "Unread") existing.unreadCount += 1;
      existing.isArchived = existing.memoIds.every((id) => archivedIds.has(id));
      dmMap.set(cp, existing);
    });

    return [...dmMap.values(), ...groupMap.values()]
      .filter((conversation) => {
        if (conversation.kind === "group") return true;
        if (isSelfConversation(conversation.employeeId, selfProfile)) return false;
        const profileName = conversation.profile.name.trim().toLowerCase();
        const selfName = selfProfile.fullName?.trim().toLowerCase();
        return !(selfName && profileName === selfName);
      })
      .sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        if (aTime !== bTime) {
          if (!a.lastMessageAt && b.lastMessageAt) return 1;
          if (a.lastMessageAt && !b.lastMessageAt) return -1;
          return bTime - aTime;
        }
        return a.profile.name.localeCompare(b.profile.name);
      });
  }, [employeeId, isCompanyScope, teamMembers, departmentLabel, messages, profileMap, resolveActiveCounterpart, rowStatus, archivedIds, selfProfile]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (conv.kind === "dm") {
        if (isSelfConversation(conv.employeeId, selfProfile)) return false;
        const profileName = conv.profile.name.trim().toLowerCase();
        const selfName = selfProfile.fullName?.trim().toLowerCase();
        if (selfName && profileName === selfName) return false;
      }
      if (conversationFilter === "unread" && conv.unreadCount === 0) return false;
      if (conversationFilter === "archived" && !conv.isArchived) return false;
      if (conversationFilter === "all" && conv.isArchived) return false;
      if (!q) return true;
      return (
        conv.profile.name.toLowerCase().includes(q) ||
        conv.profile.designation.toLowerCase().includes(q) ||
        conv.profile.department.toLowerCase().includes(q) ||
        conv.lastMessage.toLowerCase().includes(q) ||
        (conv.groupName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [conversations, searchQuery, conversationFilter, selfProfile]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  );

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.key === selectedKey) ?? null,
    [conversations, selectedKey],
  );

  const archiveSelectedConversation = useCallback(() => {
    if (!selectedConversation) return;
    selectedConversation.memoIds.forEach((id) => markArchived(id));
    toast.success("Conversation archived");
  }, [selectedConversation, markArchived]);

  const unarchiveSelectedConversation = useCallback(() => {
    if (!selectedConversation) return;
    selectedConversation.memoIds.forEach((id) => markUnarchived(id));
    toast.success("Conversation restored");
  }, [selectedConversation, markUnarchived]);

  const conversationMemos = useMemo(() => {
    const self = normalizeId(employeeId);
    if (!self || !selectedConversation) return [] as MemoItem[];

    if (selectedConversation.kind === "group" && selectedConversation.groupId) {
      return messages
        .filter((memo) => parseGroupSubject(memo.subject)?.groupId === selectedConversation.groupId)
        .sort(
          (a, b) =>
            new Date(a.createdAt || a.issuedDate || 0).getTime() -
            new Date(b.createdAt || b.issuedDate || 0).getTime(),
        );
    }

    const selectedId = normalizeId(selectedConversation.employeeId);
    if (!selectedId) return [] as MemoItem[];
    return messages
      .filter((memo) => !isGroupMemo(memo) && resolveActiveCounterpart(memo, self) === selectedId)
      .sort(
        (a, b) =>
          new Date(a.createdAt || a.issuedDate || 0).getTime() -
          new Date(b.createdAt || b.issuedDate || 0).getTime(),
      );
  }, [messages, selectedConversation, employeeId, resolveActiveCounterpart]);

  const latestThreadId = useMemo(() => {
    if (conversationMemos.length === 0) return null;
    const latest = [...conversationMemos].sort(
      (a, b) =>
        new Date(b.createdAt || b.issuedDate || 0).getTime() -
        new Date(a.createdAt || a.issuedDate || 0).getTime(),
    )[0];
    return latest?.id ?? null;
  }, [conversationMemos]);

  const loadThread = useCallback(async (memoId: number) => {
    try {
      const data = await fetch(`${BACKEND}/employee-memo/${memoId}`, {
        headers: authHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : null));
      const replies = Array.isArray(data?.replies) ? data.replies : [];
      setThreads((prev) => ({ ...prev, [memoId]: replies }));
    } catch {
      /* ignore */
    }
  }, []);

  const loadConversationThreads = useCallback(
    async (memoIds: number[]) => {
      if (memoIds.length === 0) {
        setThreads({});
        return;
      }
      setThreadsLoading(true);
      try {
        await Promise.all(memoIds.map((id) => loadThread(id)));
      } finally {
        setThreadsLoading(false);
      }
    },
    [loadThread],
  );

  useEffect(() => {
    if (!selectedConversation) return;
    void loadConversationThreads(selectedConversation.memoIds);
    selectedConversation.memoIds.forEach((id) => {
      const memo = messages.find((m) => m.id === id);
      if (memo && rowStatus(memo) === "Unread") markRead(id);
    });
  }, [selectedConversation, loadConversationThreads, messages, rowStatus, markRead]);

  useMemoChatPolling<{ replies?: MemoReply[] }>(
    latestThreadId,
    (data) => {
      if (!latestThreadId) return;
      const replies = Array.isArray(data?.replies) ? data.replies : [];
      setThreads((prev) => ({ ...prev, [latestThreadId]: replies }));
    },
    selectedKey != null && latestThreadId != null,
    2500,
    authHeaders,
  );

  useEffect(() => {
    if (!selectedConversation?.memoIds.length) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadConversationThreads(selectedConversation.memoIds);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [selectedConversation, loadConversationThreads]);

  const chatBubbles = useMemo(() => {
    const self = normalizeId(employeeId) ?? (isCompanyScope ? ADMIN_SELF_ID : null);
    if (!self) return [] as ChatBubble[];
    const bubbles: ChatBubble[] = [];

    conversationMemos.forEach((memo) => {
      bubbles.push({
        id: memo.id,
        threadMemoId: memo.id,
        text: memo.description || memo.subject || "",
        isOutgoing: isSent(memo),
        senderName: memo.issuedBy?.trim() || "User",
        createdAt: memoTimestamp(memo),
        attachmentPath: memo.attachmentPath,
      });

      const replies = threads[memo.id] || [];
      replies.forEach((reply) => {
        const replySelf =
          normalizeId(reply.senderEmployeeId) === normalizeId(employeeId) ||
          (isCompanyScope &&
            !normalizeId(reply.senderEmployeeId) &&
            String(reply.issuedBy || "").trim().toLowerCase() === String(managerName || "").trim().toLowerCase());
        bubbles.push({
          id: reply.id,
          threadMemoId: memo.id,
          text: reply.description || "",
          isOutgoing: replySelf,
          senderName: reply.issuedBy?.trim() || "User",
          createdAt: reply.createdAt || null,
          attachmentPath: reply.attachmentPath,
        });
      });
    });

    return bubbles.sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
    );
  }, [conversationMemos, threads, employeeId, isSent, isCompanyScope, managerName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatBubbles, selectedKey, threadsLoading]);

  useEffect(() => {
    const self = normalizeId(employeeId);
    const visible = filteredConversations.filter((conversation) => {
      if (conversation.kind === "group") return true;
      return conversation.employeeId !== self;
    });
    if (visible.length === 0) {
      setSelectedKey(null);
      return;
    }

    const stillValid = selectedKey != null && visible.some((conversation) => conversation.key === selectedKey);
    if (stillValid) return;

    // Mobile: stay on conversation list until the user taps a profile.
    if (isCompact) {
      setSelectedKey(null);
      return;
    }

    const withMessages =
      visible.find((conversation) => conversation.memoIds.length > 0 || conversation.lastMessageAt) ?? visible[0];
    setSelectedKey(withMessages.key);
  }, [filteredConversations, selectedKey, employeeId, isCompact]);

  const portalHeader = useMemo(
    () =>
      active
        ? {
            icon: MessageSquare,
            title: "Internal Messaging",
            subtitle: "Direct messages and group conversations",
            messageBadgeCount: totalUnread,
          }
        : null,
    [active, totalUnread],
  );

  useEmpPortalPageHeader(isAdminVariant ? null : portalHeader);

  const selectConversation = (key: string) => {
    setSelectedKey(key);
    if (isCompact) setSidebarOpen(false);
  };

  const toggleGroupMember = (id: number) => {
    setGroupMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const createGroupChat = async () => {
    const self = normalizeId(employeeId);
    const name = groupNameDraft.trim();
    if (!canCompose) return;
    if (!name) {
      toast.error("Enter a group name");
      return;
    }
    if (groupMemberIds.length < 2) {
      toast.error("Select at least 2 team members");
      return;
    }

    setCreatingGroup(true);
    try {
      const groupId = createGroupId();
      const res = await fetch(`${BACKEND}/employee-memo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          employeeIDs: groupMemberIds,
          memoType: "General",
          subject: encodeGroupSubject(groupId, name),
          description: `${managerName} created the group “${name}”.`,
          issuedDate: new Date().toISOString().slice(0, 10),
          issuedBy: managerName,
          issuedByRole: issuedByRoleLabel,
          ...(self ? { senderEmployeeId: self } : {}),
          ...(senderContext.companyID ? { companyID: senderContext.companyID } : {}),
          ...(senderContext.branchesID ? { branchesID: senderContext.branchesID } : {}),
          ...(senderContext.serviceProviderID ? { serviceProviderID: senderContext.serviceProviderID } : {}),
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || "Could not create group");
      }

      setShowCreateGroup(false);
      setGroupNameDraft("");
      setGroupMemberIds([]);
      setGroupMemberSearch("");
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`_pc_${panelCacheKey}`);
      }
      await load({ silent: true });
      setSelectedKey(groupConversationKey(groupId));
      toast.success("Group created");
    } catch {
      toast.error("Could not create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    const self = normalizeId(employeeId);
    if (!text || !canCompose || !selectedConversation) return;

    if (selectedConversation.kind === "group") {
      if (!selectedConversation.groupId || !selectedConversation.groupName) return;
      const recipients = selectedConversation.memberIds.filter((id) => id !== self);
      if (recipients.length === 0) {
        toast.error("This group has no other members");
        return;
      }

      setSending(true);
      try {
        let attachmentPath: string | undefined;
        if (attachmentFile) {
          attachmentPath = await uploadAttachmentFile(attachmentFile);
        }

        const res = await fetch(`${BACKEND}/employee-memo`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            employeeIDs: recipients,
            memoType: "General",
            subject: encodeGroupSubject(selectedConversation.groupId, selectedConversation.groupName),
            description: text,
            issuedDate: new Date().toISOString().slice(0, 10),
            issuedBy: managerName,
            issuedByRole: issuedByRoleLabel,
            ...(self ? { senderEmployeeId: self } : {}),
            attachmentPath,
            ...(senderContext.companyID ? { companyID: senderContext.companyID } : {}),
            ...(senderContext.branchesID ? { branchesID: senderContext.branchesID } : {}),
            ...(senderContext.serviceProviderID ? { serviceProviderID: senderContext.serviceProviderID } : {}),
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(errText || "Send failed");
        }

        setDraft("");
        setAttachmentFile(null);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(`_pc_${panelCacheKey}`);
        }
        await load({ silent: true });
        setSelectedKey(selectedConversation.key);
      } catch {
        toast.error("Could not send message");
      } finally {
        setSending(false);
      }
      return;
    }

    const recipientId = normalizeId(selectedConversation.employeeId);
    if (!recipientId) return;
    if (self && (recipientId === self || isSelfConversation(recipientId, selfProfile))) {
      toast.error("You cannot message yourself");
      return;
    }
    const recipientProfile = selectedConversation.profile;
    if (
      recipientProfile &&
      selfProfile.fullName &&
      recipientProfile.name.trim().toLowerCase() === selfProfile.fullName.trim().toLowerCase()
    ) {
      toast.error("You cannot message yourself");
      return;
    }

    setSending(true);
    try {
      let attachmentPath: string | undefined;
      if (attachmentFile) {
        attachmentPath = await uploadAttachmentFile(attachmentFile);
      }

      const res = await fetch(`${BACKEND}/employee-memo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          employeeIDs: [recipientId],
          memoType: "General",
          subject: "Message",
          description: text,
          issuedDate: new Date().toISOString().slice(0, 10),
          issuedBy: managerName,
          issuedByRole: issuedByRoleLabel,
          ...(self ? { senderEmployeeId: self } : {}),
          attachmentPath,
          ...(senderContext.companyID ? { companyID: senderContext.companyID } : {}),
          ...(senderContext.branchesID ? { branchesID: senderContext.branchesID } : {}),
          ...(senderContext.serviceProviderID ? { serviceProviderID: senderContext.serviceProviderID } : {}),
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || "Send failed");
      }

      setDraft("");
      setAttachmentFile(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`_pc_${panelCacheKey}`);
      }
      await load({ silent: true });
      setSelectedKey(dmConversationKey(recipientId));
    } catch {
      toast.error("Could not send message");
    } finally {
      setSending(false);
    }
  };

  const onComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const groupedBubbles = useMemo(() => {
    const groups: { date: string; items: ChatBubble[] }[] = [];
    chatBubbles.forEach((bubble) => {
      const dateKey = bubble.createdAt ? bubble.createdAt.slice(0, 10) : "unknown";
      const last = groups[groups.length - 1];
      if (!last || last.date.slice(0, 10) !== dateKey) {
        groups.push({ date: bubble.createdAt || dateKey, items: [bubble] });
      } else {
        last.items.push(bubble);
      }
    });
    return groups;
  }, [chatBubbles]);

  const selectedPresence = selectedConversation
    ? presenceFromProfile(selectedConversation.profile)
    : "offline";

  const showConversationLoader =
    (loading || teamLoading) &&
    filteredConversations.length === 0 &&
    messages.length === 0 &&
    teamMembers.length === 0;

  const showSidebar = !isCompact || sidebarOpen;
  // Mobile: list and chat are mutually exclusive — never side-by-side (prevents right-edge bleed).
  const showChatPane = !isCompact || !sidebarOpen;

  const closeCreateGroup = useCallback(() => {
    setShowCreateGroup(false);
    setGroupNameDraft("");
    setGroupMemberIds([]);
    setGroupMemberSearch("");
  }, []);

  useEffect(() => {
    if (!showCreateGroup) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCreateGroup();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [showCreateGroup, closeCreateGroup]);

  const createGroupModal =
    showCreateGroup && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close create group"
              className="absolute inset-0 bg-black/45"
              onClick={closeCreateGroup}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-group-title"
              className="relative z-10 flex max-h-[min(560px,90vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-white text-[#111827] shadow-[0_25px_60px_rgba(0,0,0,0.28)]"
            >
              <div className="flex items-center justify-between border-b border-[#EEF2F7] px-5 py-4">
                <div>
                  <h3 id="create-group-title" className="text-[16px] font-semibold text-[#111827]">
                    Create group
                  </h3>
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">Select members and name your group</p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateGroup}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F8F9FC]"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto px-5 py-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[#6B7280]">Group name</label>
                  <input
                    value={groupNameDraft}
                    onChange={(e) => setGroupNameDraft(e.target.value)}
                    placeholder="e.g. Project Alpha"
                    className="h-10 w-full rounded-xl border border-[#EEF2F7] bg-white px-3 text-[14px] text-[#111827] outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-[12px] font-medium text-[#6B7280]">Members</label>
                    <span className="text-[11px] text-[#9CA3AF]">{groupMemberIds.length} selected</span>
                  </div>
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      value={groupMemberSearch}
                      onChange={(e) => setGroupMemberSearch(e.target.value)}
                      placeholder="Search team members..."
                      className="h-9 w-full rounded-xl border border-[#EEF2F7] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[#EEF2F7] bg-white p-1.5">
                    {teamMembers
                      .filter((member) => {
                        const id = normalizeId(member.id);
                        if (!id || isSelfEmployee(member, selfProfile)) return false;
                        const q = groupMemberSearch.trim().toLowerCase();
                        if (!q) return true;
                        const name = reporteeDisplayName(member).toLowerCase();
                        const desig = (member.designation || "").toLowerCase();
                        return name.includes(q) || desig.includes(q);
                      })
                      .map((member) => {
                        const id = normalizeId(member.id)!;
                        const selected = groupMemberIds.includes(id);
                        const name = reporteeDisplayName(member);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleGroupMember(id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150",
                              selected ? "bg-primary/10" : "hover:bg-[#F8F9FC]",
                            )}
                          >
                            <ConversationAvatar
                              profile={profileFromTeamMember(member, departmentLabel)}
                              size="sm"
                              showPresence={false}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-[#111827]">{name}</p>
                              <p className="truncate text-[11px] text-[#6B7280]">
                                {member.designation?.trim() || "Team Member"}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "flex size-5 items-center justify-center rounded-md border",
                                selected
                                  ? "border-primary bg-primary text-white"
                                  : "border-[#D1D5DB] bg-white text-transparent",
                              )}
                            >
                              <Check className="size-3" />
                            </span>
                          </button>
                        );
                      })}
                    {teamMembers.filter((m) => !isSelfEmployee(m, selfProfile)).length === 0 ? (
                      <p className="px-3 py-6 text-center text-[12px] text-[#6B7280]">No team members available</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#EEF2F7] px-5 py-4">
                <button
                  type="button"
                  onClick={closeCreateGroup}
                  className="rounded-xl px-4 py-2 text-[13px] font-medium text-[#6B7280] hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={creatingGroup || groupMemberIds.length < 2 || !groupNameDraft.trim()}
                  onClick={() => void createGroupChat()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Users className="size-3.5" />
                  {creatingGroup ? "Creating…" : "Create group"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={cn(
        "im-workspace relative flex overflow-hidden rounded-2xl border border-[#EEF2F7] bg-white font-['Inter',sans-serif] text-[#111827] shadow-[0_2px_10px_rgba(15,23,42,0.05)]",
        isAdminVariant
          ? "h-full max-h-full"
          : isCompact
            ? "h-full min-h-0 w-full rounded-none border-0 shadow-none"
            : "h-full min-h-0 w-full",
      )}
    >
      {createGroupModal}
      {(loading || teamLoading) && filteredConversations.length > 0 ? (
        <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-full border border-[#EEF2F7] bg-white px-3 py-1 text-[11px] text-[#6B7280] shadow-sm">
          Updating…
        </div>
      ) : null}
      {showSidebar ? (
        <aside
          className={cn(
            "flex shrink-0 flex-col border-r border-[#EEF2F7] bg-white",
            isCompact ? "h-full w-full max-w-full border-r-0" : "h-full w-full md:w-[360px]",
          )}
        >
          <div className="border-b border-[#EEF2F7] px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[26px] font-semibold tracking-tight text-[#111827]">Conversations</h2>
                <p className="mt-0.5 text-[13px] text-[#6B7280]">{departmentLabel}</p>
              </div>
              {canCompose ? (
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-white transition-colors duration-150 hover:bg-primary/90"
                >
                  <Plus className="size-3.5" />
                  New group
                </button>
              ) : null}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="h-10 w-full rounded-xl border border-[#EEF2F7] bg-white pl-9 pr-3 text-[14px] text-[#111827] outline-none transition-colors duration-150 placeholder:text-[#9CA3AF] focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex size-10 items-center justify-center rounded-xl border border-[#EEF2F7] bg-white text-[#6B7280] transition-colors duration-150 hover:bg-[#F8F9FC]"
                    aria-label="Filter conversations"
                  >
                    <Filter className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 border border-[#EEF2F7] bg-white">
                  <DropdownMenuItem onClick={() => setConversationFilter("all")}>All</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConversationFilter("unread")}>Unread</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConversationFilter("archived")}>Archived</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {showConversationLoader ? (
              <p className="px-3 py-8 text-center text-[13px] text-[#6B7280]">Loading conversations…</p>
            ) : filteredConversations.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-[#6B7280]">
                {searchQuery.trim()
                  ? "No conversations match your search."
                  : isCompanyScope
                    ? "No employees found yet. Company employees will appear here."
                    : "No team members found yet. Colleagues from your department or company will appear here."}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredConversations.map((conv) => {
                  const isSelected = conv.key === selectedKey;
                  const preview =
                    conv.lastMessage.length > 48
                      ? `${conv.lastMessage.slice(0, 48)}…`
                      : conv.lastMessage || (conv.kind === "group" ? "Tap to open group chat" : "Tap to start chatting");
                  return (
                    <button
                      key={conv.key}
                      type="button"
                      onClick={() => selectConversation(conv.key)}
                      className={cn(
                        "flex h-[76px] w-full items-center gap-3 rounded-xl px-3.5 py-3.5 text-left transition-colors duration-150",
                        isSelected ? "bg-primary/10" : "hover:bg-[#F8F9FC]",
                      )}
                    >
                      <ConversationAvatar profile={conv.profile} size="sm" isGroup={conv.kind === "group"} showPresence={conv.kind === "dm"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[15px] font-medium text-[#111827]">{conv.profile.name}</p>
                          <span className="shrink-0 text-[12px] text-[#9CA3AF]">
                            {formatListTime(conv.lastMessageAt)}
                          </span>
                        </div>
                        <p className="truncate text-[12px] text-[#6B7280]">
                          {conv.kind === "group"
                            ? conv.profile.department
                            : `${conv.profile.designation} • ${conv.profile.department}`}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] text-[#6B7280]">
                            {conv.lastMessage ? `"${preview}"` : preview}
                          </p>
                          {conv.unreadCount > 0 ? (
                            <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-white">
                              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      ) : null}

      {showChatPane ? (
      <section className={cn("flex min-h-0 min-w-0 flex-col bg-[#F8F9FC]", isCompact ? "h-full w-full" : "h-full flex-1")}>
        {selectedConversation ? (
          <>
            <header className="flex h-[72px] items-center justify-between border-b border-[#EEF2F7] bg-white px-4 md:px-5">
              <div className="flex min-w-0 items-center gap-3">
                {isCompact ? (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="inline-flex size-9 items-center justify-center rounded-lg text-[#6B7280] transition-colors duration-150 hover:bg-[#F8F9FC]"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                ) : null}
                <ConversationAvatar
                  profile={selectedConversation.profile}
                  size="lg"
                  isGroup={selectedConversation.kind === "group"}
                  showPresence={selectedConversation.kind === "dm"}
                />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[#111827]">
                    {selectedConversation.profile.name}
                  </p>
                  <p className="truncate text-[13px] text-[#6B7280]">
                    {selectedConversation.kind === "group"
                      ? selectedConversation.profile.department
                      : `${selectedConversation.profile.designation} • ${selectedConversation.profile.department}`}
                  </p>
                  {selectedConversation.kind === "dm" ? (
                    <p className="text-[12px] font-medium text-[#6B7280]">
                      {presenceLabel(selectedPresence)}
                    </p>
                  ) : (
                    <p className="text-[12px] font-medium text-[#6B7280]">Group conversation</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg text-[#6B7280] hover:bg-[#F8F9FC] hover:text-[#111827]"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border border-border bg-popover text-popover-foreground">
                    {selectedConversation.isArchived ? (
                      <DropdownMenuItem onClick={unarchiveSelectedConversation}>
                        Unarchive conversation
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={archiveSelectedConversation}
                        disabled={selectedConversation.memoIds.length === 0}
                      >
                        Archive conversation
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => void load()}>Refresh messages</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
              {threadsLoading && chatBubbles.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-[#6B7280]">Loading messages…</p>
              ) : chatBubbles.length === 0 ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MessageSquare className="size-5" />
                  </div>
                  <p className="text-[15px] font-medium text-[#111827]">No messages yet</p>
                  <p className="mt-1 max-w-sm text-[13px] text-[#6B7280]">
                    {canCompose
                      ? "Send a message below to start this conversation."
                      : "Messages from this contact will appear here."}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedBubbles.map((group, groupIndex) => (
                    <div key={`${group.date}-${groupIndex}`} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-[#EEF2F7]" />
                        <span className="text-[12px] font-medium text-[#9CA3AF]">
                          {formatDateSeparator(group.date)}
                        </span>
                        <div className="h-px flex-1 bg-[#EEF2F7]" />
                      </div>
                      {group.items.map((bubble) => (
                        <div
                          key={bubble.id}
                          className={cn("flex", bubble.isOutgoing ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[65%] rounded-[18px] px-4 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.05)]",
                              bubble.isOutgoing
                                ? "bg-primary/10 text-[#111827]"
                                : "border border-[#EEF2F7] bg-white text-[#111827]",
                            )}
                          >
                            {selectedConversation.kind === "group" && !bubble.isOutgoing ? (
                              <p className="mb-1 text-[11px] font-semibold text-primary">{bubble.senderName}</p>
                            ) : null}
                            <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{bubble.text}</p>
                            {bubble.attachmentPath ? (
                              <AttachmentPreview path={bubble.attachmentPath} />
                            ) : null}
                            <div
                              className={cn(
                                "mt-1.5 flex items-center gap-1 text-[11px] text-[#9CA3AF]",
                                bubble.isOutgoing ? "justify-end" : "justify-start",
                              )}
                            >
                              <span>{formatBubbleTime(bubble.createdAt)}</span>
                              {bubble.isOutgoing ? <CheckCheck className="size-3.5 text-primary" /> : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <footer className="border-t border-[#EEF2F7] bg-white px-4 py-4 md:px-5">
              {attachmentFile ? (
                <div className="mb-3 flex items-center gap-2">
                  <Paperclip className="size-4 shrink-0 text-primary" />
                  <span className="truncate text-[12px] text-primary">{attachmentFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachmentFile(null)}
                    className="text-[12px] font-medium text-[#6B7280] hover:text-[#111827]"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 items-end rounded-2xl border border-[#EEF2F7] bg-white px-3 py-2 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onComposerKeyDown}
                    rows={1}
                    placeholder="Type your message..."
                    className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#9CA3AF]"
                  />
                  <div className="ml-2 flex items-center gap-1 pb-0.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                      onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors duration-150 hover:bg-[#F8F9FC]"
                      aria-label="Attach file"
                    >
                      <Paperclip className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => `${prev}🙂`)}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors duration-150 hover:bg-[#F8F9FC]"
                      aria-label="Insert emoji"
                    >
                      <Smile className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.message("Mentions coming soon")}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors duration-150 hover:bg-[#F8F9FC]"
                      aria-label="Mention someone"
                    >
                      <AtSign className="size-4" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={sending || !draft.trim()}
                  onClick={() => void sendMessage()}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-all duration-[120ms] hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <SendHorizontal className="size-4" />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-[#F8F9FC] p-8 text-center">
            {isCompact && !sidebarOpen ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="mb-4 inline-flex items-center gap-2 rounded-xl border border-[#EEF2F7] bg-white px-4 py-2 text-[13px] font-medium text-primary"
              >
                <ArrowLeft className="size-4" />
                Open conversations
              </button>
            ) : null}
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquare className="size-5" />
            </div>
            <p className="text-[15px] font-medium text-[#111827]">Select a conversation</p>
            <p className="mt-1 max-w-sm text-[13px] text-[#6B7280]">
              Choose a team member or group from the left to view messages and continue the conversation.
            </p>
          </div>
        )}
      </section>
      ) : null}
    </div>
  );
}
