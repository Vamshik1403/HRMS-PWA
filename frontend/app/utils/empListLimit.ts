export const EMP_MOBILE_PREVIEW_LIMIT = 5;

export function splitPreviewRecords<T>(items: T[], limit = EMP_MOBILE_PREVIEW_LIMIT) {
  return {
    preview: items.slice(0, limit),
    history: items.slice(limit),
    hasHistory: items.length > limit,
  };
}
