import { ScheduleItem, ScheduleItemAutomation } from "../types/propresenter";

function normalizeSessionKey(session: string | undefined | null): string {
  return (session ?? "").trim().toLowerCase();
}

function normalizeAutomationList(
  item: ScheduleItem
): ScheduleItemAutomation[] | undefined {
  // Prefer modern `automations` array; fall back to legacy single `automation`
  const list =
    item.automations ??
    ((item as any).automation ? [(item as any).automation] : undefined);
  if (!list || !Array.isArray(list) || list.length === 0) return undefined;
  // Trust existing normalization elsewhere; here we just ensure "undefined" vs empty array consistency.
  return list.filter(Boolean) as ScheduleItemAutomation[];
}

/**
 * Removes all automation fields from a schedule. This ensures automations are never synced over the network.
 */
export function stripScheduleAutomations(schedule: ScheduleItem[]): ScheduleItem[] {
  return schedule.map((item) => {
    const { automations: _automations, ...rest } = item as any;
    // also remove any legacy `automation` field if present
    const { automation: _automation, ...rest2 } = rest;
    return rest2 as ScheduleItem;
  });
}

/**
 * Merge an incoming schedule with *local* automations by matching on the session name.
 *
 * Rules:
 * - Never import automations from incoming schedule (master)
 * - If an incoming item matches a local item by session name (case-insensitive), apply the local automations
 * - If no match, the incoming item gets no automations ("undo automation" for mismatched sessions)
 */
export function mergeScheduleWithLocalAutomations(
  localSchedule: ScheduleItem[],
  incomingSchedule: ScheduleItem[]
): ScheduleItem[] {
  // Build map of sessionName -> automations
  const localAutoBySession = new Map<string, ScheduleItemAutomation[] | undefined>();
  for (const item of localSchedule) {
    const key = normalizeSessionKey(item.session);
    if (!key) continue;
    // Keep first match to make behavior deterministic when duplicates exist
    if (localAutoBySession.has(key)) continue;
    localAutoBySession.set(key, normalizeAutomationList(item));
  }

  // Apply local automations to incoming, stripping any incoming automations.
  const strippedIncoming = stripScheduleAutomations(incomingSchedule);
  return strippedIncoming.map((item) => {
    const key = normalizeSessionKey(item.session);
    const automations = key ? localAutoBySession.get(key) : undefined;
    return {
      ...item,
      ...(automations && automations.length > 0 ? { automations } : {}),
    };
  });
}

