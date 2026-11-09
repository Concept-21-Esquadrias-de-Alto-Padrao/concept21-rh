const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isReviewedPilotAdmin(
  userId: string,
  primaryUserId: string | undefined,
  recoveryUserId: string | undefined,
): boolean {
  if (!uuid.test(userId)) return false;
  return [primaryUserId, recoveryUserId].some((approved) =>
    Boolean(approved && uuid.test(approved) && userId === approved));
}
