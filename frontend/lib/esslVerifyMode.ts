/**
 * Map eSSL / ZKTeco ATTLOG verify-mode field (5th token) to HRMS auth_type.
 * @see https://www.zkteco.com — modes vary by firmware; 2 and 4 are both used for RFID card.
 */
export function mapEsslVerifyModeToAuthType(verifyMode: string): string | null {
  switch (verifyMode) {
    case "0":
    case "3":
      return "PIN";
    case "1":
      return "FINGER";
    case "2":
    case "4":
      return "CARD";
    case "15":
      return "FACE";
    default:
      return null;
  }
}

/** Parse auth_type from a full ATTLOG line (tab/space-separated). */
export function parseAuthTypeFromAttlogLine(rawBody: string | null | undefined): string | null {
  if (!rawBody?.trim()) return null;
  const parts = rawBody.trim().split(/\s+/);
  if (parts.length < 5) return null;
  return mapEsslVerifyModeToAuthType(parts[4]);
}
