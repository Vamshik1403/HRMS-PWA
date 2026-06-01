/** Human-readable shift classification from isFlexible + isRotating flags. */
export function getWorkShiftTypeLabel(
  isFlexible?: boolean | null,
  isRotating?: boolean | null,
): string {
  const flex = isFlexible === true;
  const rot = isRotating === true;
  if (flex && rot) return "Flexible Rotating";
  if (flex) return "Flexible Non Rotating";
  if (rot) return "Fixed Rotating";
  return "Fixed Non Rotating";
}
