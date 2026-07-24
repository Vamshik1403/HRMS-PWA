"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  CheckCheck,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Search,
  SendHorizontal,
  Smile,
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
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

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
  employeeId: number;
  profile: EmployeeProfile;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  memoIds: number[];
  isArchived: boolean;
};

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
}: {
  profile: EmployeeProfile;
  size?: "sm" | "md" | "lg";
  showPresence?: boolean;
}) {
  const presence = presenceFromProfile(profile);
  const sizeClass = size === "lg" ? "size-11" : size === "sm" ? "size-10" : "size-10";
  const textClass = size === "lg" ? "text-sm" : "text-xs";

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
            "flex items-center justify-center rounded-full bg-[#EEF2FF] text-[13px] font-semibold text-[#4F46E5]",
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
      className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-[#EEF2F7] bg-white px-3 py-2 text-[13px] font-medium text-[#4F46E5] transition-colors duration-150 hover:bg-[#F8F9FC]"
    >
      <Paperclip className="size-4 shrink-0" />
      <span className="truncate">{fileName || label}</span>
    </a>
  );
}

export function EmpProfileMessagingPanel({ active = true }: { active?: boolean } = {}) {
  const user = useCurrentUser();
  const { scope, isManagerView } = useEmpManagerScope();
  const [messages, setMessages] = useState<MemoItem[]>([]);
  const [threads, setThreads] = useState<Record<number, MemoReply[]>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [departmentLabel, setDepartmentLabel] = useState("Your Team");
  const [loading, setLoading] = useState(false);
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hydratedRef = useRef(false);

  const canCompose = Boolean(employeeId);

  const persistPanelCache = useCallback(
    (payload: {
      employeeId: number;
      messages: MemoItem[];
      teamMembers: TeamMemberRow[];
      departmentLabel: string;
      selfProfile: SelfProfile;
    }) => {
      setPageCache(IM_PANEL_CACHE_KEY, payload);
    },
    [],
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

  useEffect(() => {
    const compactMq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => {
      setIsCompact(compactMq.matches);
      if (compactMq.matches) setSidebarOpen(true);
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
        const creds = await fetch(
          `${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`,
          { headers: authHeaders() },
        ).then((r) => (r.ok ? r.json() : null));
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
        setSenderContext({
          companyID: normalizeId(creds?.companyID ?? creds?.employee?.companyID) ?? undefined,
          branchesID: normalizeId(creds?.employee?.branchesID) ?? undefined,
          serviceProviderID: normalizeId(creds?.serviceProviderID) ?? undefined,
        });
        setManagerName(nextSelfProfile.fullName || user.username || "Manager");
        if (!empId) {
          setMessages([]);
          return;
        }
        setReadIds(loadIdSet(readStorageKey(empId)));
        setArchivedIds(loadIdSet(archiveStorageKey(empId)));

        const data = await fetch(`${BACKEND}/employee-memo?employeeID=${empId}`, {
          headers: authHeaders(),
        }).then((r) => (r.ok ? r.json() : []));
        const list = (Array.isArray(data) ? data : []).filter((m: MemoItem) => isGeneralMemo(m));
        list.sort(
          (a: MemoItem, b: MemoItem) =>
            new Date(b.createdAt || b.issuedDate || 0).getTime() -
            new Date(a.createdAt || a.issuedDate || 0).getTime(),
        );
        setMessages(list);
        if (list.length === 0 && typeof window !== "undefined") {
          sessionStorage.removeItem(`_pc_${IM_PANEL_CACHE_KEY}`);
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith("im-read-") || key.startsWith("im-archived-")) {
              localStorage.removeItem(key);
            }
          }
        }
        await loadTeamContacts(empId, nextSelfProfile, { silent: true });
      } catch {
        if (!options?.silent) setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [loadTeamContacts, messages.length, teamMembers.length, user?.username],
  );

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const cached = getPageCache<ImPanelCache>(IM_PANEL_CACHE_KEY);
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
    if (!employeeId) return;
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
  }, [employeeId, load]);

  useEffect(() => {
    const id = normalizeId(employeeId);
    if (!id || messages.length === 0 && teamMembers.length === 0) return;
    persistPanelCache({
      employeeId: id,
      messages,
      teamMembers,
      departmentLabel,
      selfProfile,
    });
  }, [departmentLabel, employeeId, messages, persistPanelCache, selfProfile, teamMembers]);

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
      if (!self) return false;
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
    [employeeId, selfProfile.fullName],
  );

  const isSent = useCallback(
    (m: MemoItem) => {
      const self = normalizeId(employeeId);
      const senderId = normalizeId(m.senderEmployeeId);
      return self != null && senderId === self;
    },
    [employeeId],
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
      if (!employeeId) return;
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveIdSet(readStorageKey(employeeId), next);
        return next;
      });
    },
    [employeeId],
  );

  const markArchived = useCallback(
    (id: number) => {
      if (!employeeId) return;
      setArchivedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveIdSet(archiveStorageKey(employeeId), next);
        return next;
      });
    },
    [employeeId],
  );

  const conversations = useMemo(() => {
    const self = normalizeId(employeeId);
    if (!self) return [] as Conversation[];
    const map = new Map<number, Conversation>();

    teamMembers.forEach((member) => {
      const memberId = normalizeId(member.id);
      if (!memberId || isSelfEmployee(member, selfProfile)) return;
      map.set(memberId, {
        employeeId: memberId,
        profile: profileFromTeamMember(member, departmentLabel),
        lastMessage: "",
        lastMessageAt: null,
        unreadCount: 0,
        memoIds: [],
        isArchived: false,
      });
    });

    messages.forEach((memo) => {
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
        map.get(cp) ||
        ({
          employeeId: cp,
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
      map.set(cp, existing);
    });

    return [...map.values()]
      .filter((conversation) => {
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
  }, [employeeId, teamMembers, departmentLabel, messages, profileMap, resolveActiveCounterpart, rowStatus, archivedIds, selfProfile]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (isSelfConversation(conv.employeeId, selfProfile)) return false;
      const profileName = conv.profile.name.trim().toLowerCase();
      const selfName = selfProfile.fullName?.trim().toLowerCase();
      if (selfName && profileName === selfName) return false;
      if (conversationFilter === "unread" && conv.unreadCount === 0) return false;
      if (conversationFilter === "archived" && !conv.isArchived) return false;
      if (conversationFilter === "all" && conv.isArchived) return false;
      if (!q) return true;
      return (
        conv.profile.name.toLowerCase().includes(q) ||
        conv.profile.designation.toLowerCase().includes(q) ||
        conv.profile.department.toLowerCase().includes(q) ||
        conv.lastMessage.toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery, conversationFilter, selfProfile]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  );

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.employeeId === selectedEmployeeId) ?? null,
    [conversations, selectedEmployeeId],
  );

  const conversationMemos = useMemo(() => {
    const self = normalizeId(employeeId);
    const selectedId = normalizeId(selectedEmployeeId);
    if (!selectedId || !self) return [] as MemoItem[];
    return messages
      .filter((memo) => resolveActiveCounterpart(memo, self) === selectedId)
      .sort(
        (a, b) =>
          new Date(a.createdAt || a.issuedDate || 0).getTime() -
          new Date(b.createdAt || b.issuedDate || 0).getTime(),
      );
  }, [messages, selectedEmployeeId, employeeId, resolveActiveCounterpart]);

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
    selectedEmployeeId != null && latestThreadId != null,
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
    if (!employeeId) return [] as ChatBubble[];
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
        bubbles.push({
          id: reply.id,
          threadMemoId: memo.id,
          text: reply.description || "",
          isOutgoing: normalizeId(reply.senderEmployeeId) === normalizeId(employeeId),
          senderName: reply.issuedBy?.trim() || "User",
          createdAt: reply.createdAt || null,
          attachmentPath: reply.attachmentPath,
        });
      });
    });

    return bubbles.sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
    );
  }, [conversationMemos, threads, employeeId, isSent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatBubbles, selectedEmployeeId, threadsLoading]);

  useEffect(() => {
    const self = normalizeId(employeeId);
    const visible = filteredConversations.filter((conversation) => conversation.employeeId !== self);
    if (visible.length === 0) {
      setSelectedEmployeeId(null);
      return;
    }

    const selectedId = normalizeId(selectedEmployeeId);
    const stillValid = selectedId != null && visible.some((conversation) => conversation.employeeId === selectedId);
    if (stillValid) return;

    const withMessages =
      visible.find((conversation) => conversation.memoIds.length > 0 || conversation.lastMessageAt) ?? visible[0];
    setSelectedEmployeeId(withMessages.employeeId);
  }, [filteredConversations, selectedEmployeeId, employeeId]);

  const portalHeader = useMemo(
    () =>
      active
        ? {
            icon: MessageSquare,
            title: "Internal Messaging",
            subtitle: "Team conversations and direct messages",
            messageBadgeCount: totalUnread,
          }
        : null,
    [active, totalUnread],
  );

  useEmpPortalPageHeader(portalHeader);

  const selectConversation = (id: number) => {
    setSelectedEmployeeId(id);
    if (isCompact) setSidebarOpen(false);
  };

  const sendMessage = async () => {
    const text = draft.trim();
    const self = normalizeId(employeeId);
    const recipientId = normalizeId(selectedEmployeeId);
    if (!text || !self || !recipientId) return;
    if (recipientId === self || isSelfConversation(recipientId, selfProfile)) {
      toast.error("You cannot message yourself");
      return;
    }
    const recipientProfile = selectedConversation?.profile;
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
          issuedByRole: isManagerView ? "MANAGER" : "EMPLOYEE",
          senderEmployeeId: self,
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
        sessionStorage.removeItem(`_pc_${IM_PANEL_CACHE_KEY}`);
      }
      await load({ silent: true });
      setSelectedEmployeeId(recipientId);
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

  return (
    <div className="im-workspace relative -mx-8 -mb-8 -mt-4 flex min-h-[calc(100dvh-10rem)] overflow-hidden rounded-2xl border border-[#EEF2F7] bg-white font-['Inter',sans-serif] text-[#111827] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
      {(loading || teamLoading) && filteredConversations.length > 0 ? (
        <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-full border border-[#EEF2F7] bg-white px-3 py-1 text-[11px] text-[#6B7280] shadow-sm">
          Updating…
        </div>
      ) : null}
      {showSidebar ? (
        <aside className="flex w-full shrink-0 flex-col border-r border-[#EEF2F7] bg-white md:w-[360px]">
          <div className="border-b border-[#EEF2F7] px-5 py-5">
            <h2 className="text-[26px] font-semibold tracking-tight text-[#111827]">Conversations</h2>
            <p className="mt-0.5 text-[13px] text-[#6B7280]">{departmentLabel}</p>
            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search employee..."
                  className="h-10 w-full rounded-xl border border-[#EEF2F7] bg-white pl-9 pr-3 text-[14px] text-[#111827] outline-none transition-colors duration-150 placeholder:text-[#9CA3AF] focus:border-[#4F46E5]/30 focus:ring-2 focus:ring-[#4F46E5]/10"
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
                  : "No team members found yet. Colleagues from your department or company will appear here."}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredConversations.map((conv) => {
                  const isSelected = conv.employeeId === selectedEmployeeId;
                  const preview =
                    conv.lastMessage.length > 48
                      ? `${conv.lastMessage.slice(0, 48)}…`
                      : conv.lastMessage || "Tap to start chatting";
                  return (
                    <button
                      key={conv.employeeId}
                      type="button"
                      onClick={() => selectConversation(conv.employeeId)}
                      className={cn(
                        "flex h-[76px] w-full items-center gap-3 rounded-xl px-3.5 py-3.5 text-left transition-colors duration-150",
                        isSelected ? "bg-[#EEF2FF]" : "hover:bg-[#F8F9FC]",
                      )}
                    >
                      <ConversationAvatar profile={conv.profile} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[15px] font-medium text-[#111827]">{conv.profile.name}</p>
                          <span className="shrink-0 text-[12px] text-[#9CA3AF]">
                            {formatListTime(conv.lastMessageAt)}
                          </span>
                        </div>
                        <p className="truncate text-[12px] text-[#6B7280]">
                          {conv.profile.designation} • {conv.profile.department}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] text-[#6B7280]">
                            {conv.lastMessage ? `"${preview}"` : preview}
                          </p>
                          {conv.unreadCount > 0 ? (
                            <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] px-1.5 py-0.5 text-[11px] font-semibold text-white">
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

      <section className="flex min-w-0 flex-1 flex-col bg-[#F8F9FC]">
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
                <ConversationAvatar profile={selectedConversation.profile} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[#111827]">
                    {selectedConversation.profile.name}
                  </p>
                  <p className="truncate text-[13px] text-[#6B7280]">
                    {selectedConversation.profile.designation} • {selectedConversation.profile.department}
                  </p>
                  <p className="text-[12px] font-medium text-[#6B7280]">
                    {presenceLabel(selectedPresence)}
                  </p>
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
                  <DropdownMenuContent align="end" className="border border-[#EEF2F7] bg-white">
                    {selectedConversation.memoIds.map((id) => (
                      <DropdownMenuItem key={id} onClick={() => markArchived(id)}>
                        Archive conversation
                      </DropdownMenuItem>
                    ))}
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
                  <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4F46E5]">
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
                                ? "bg-[#EEF2FF] text-[#111827]"
                                : "border border-[#EEF2F7] bg-white text-[#111827]",
                            )}
                          >
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
                              {bubble.isOutgoing ? <CheckCheck className="size-3.5 text-[#4F46E5]" /> : null}
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
                  <Paperclip className="size-4 shrink-0 text-[#4F46E5]" />
                  <span className="truncate text-[12px] text-[#4F46E5]">{attachmentFile.name}</span>
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
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white transition-all duration-[120ms] hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
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
                className="mb-4 inline-flex items-center gap-2 rounded-xl border border-[#EEF2F7] bg-white px-4 py-2 text-[13px] font-medium text-[#4F46E5]"
              >
                <ArrowLeft className="size-4" />
                Open conversations
              </button>
            ) : null}
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4F46E5]">
              <MessageSquare className="size-5" />
            </div>
            <p className="text-[15px] font-medium text-[#111827]">Select a conversation</p>
            <p className="mt-1 max-w-sm text-[13px] text-[#6B7280]">
              Choose a team member from the left to view messages and continue the conversation.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
