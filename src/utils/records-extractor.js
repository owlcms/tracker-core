/**
 * Records Extraction
 *
 * Data-model helpers for working with competition records.
 *
 * - `extractRecordsFromUpdate(fopUpdate)` — legacy helper kept for backward
 *   compatibility. Returns all records carrying a non-empty `groupNameString`
 *   (i.e. provisional records claimed during *some* event). Callers that want
 *   only records claimed during the *current* event should combine this with
 *   `isCurrentCompetitionProvisionalRecord` and `getCurrentCompetitionName`.
 *
 * - `getCurrentCompetitionName(db)` — returns the current competition's name
 *   from the database payload, tolerating the various shapes used by OWLCMS.
 *
 * - `isCurrentCompetitionProvisionalRecord(record, competitionName)` — true
 *   only when `record` is a provisional record (non-empty `groupNameString`)
 *   AND its `event` matches the current competition's name. This is the
 *   predicate to use everywhere we must hide records left over from a
 *   previous event while still letting them be edited/accepted in OWLCMS.
 */

export function extractRecordsFromUpdate(fopUpdate = {}) {
  // Extract new records broken in the current session (legacy, event-agnostic).
  if (!fopUpdate?.records) return [];

  return fopUpdate.records.filter(record => {
    // New records have a non-empty groupNameString
    return record.groupNameString && record.groupNameString.length > 0;
  });
}

export function getCurrentCompetitionName(db = {}) {
  return db?.competition?.name
    || db?.competition?.competitionName
    || db?.competitionName
    || db?.config?.competitionName
    || '';
}

export function isCurrentCompetitionProvisionalRecord(record, competitionName) {
  if (!record?.groupNameString || String(record.groupNameString).trim() === '') {
    return false;
  }
  const recordEvent = record.event;
  if (!recordEvent || !competitionName) {
    return false;
  }
  return String(recordEvent).trim() === String(competitionName).trim();
}
