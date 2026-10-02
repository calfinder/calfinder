/** A physical room, normalized from an offering's building + room fields. */
export type RoomRef = { key: string; building: string; room: string };

/**
 * One lecture time in a room, as served by /api/rooms. Deliberately no instructor or description:
 * the room view only needs to show the room is in use, and cards come from the Discover data.
 */
export type RoomSlot = {
  /** Offering ids of every cross-listed copy that meets here at this time */
  ids: string[];
  code: string;
  title: string;
  building: string;
  room: string;
  meetDays: string;
  startTime: string;
  endTime: string;
};

/**
 * A few rows split a place across the two fields: part of the room in the building
 * ("Chou Hall N440 and" + "N444") or part of the building in the room ("GTU Student Services" + "Center").
 */
export function normalizeRoom(building: string, room: string): RoomRef {
  let b = (building ?? "").trim().replace(/\s+/g, " ");
  let r = (room ?? "").trim();
  const joined = b.match(/^(.*) (\S+) and$/);
  if (joined) {
    b = joined[1];
    r = r ? `${joined[2]} & ${r}` : joined[2];
  }
  if (/^(cntr|center)$/i.test(r)) {
    b = `${b} Center`;
    r = "";
  }
  return { key: `${b}|${r}`.toLowerCase(), building: b, room: r };
}

/** False for online, off-campus, and not-yet-assigned rooms. */
export function hasPhysicalRoom(building: string, room: string): boolean {
  const b = (building ?? "").trim();
  if (!b || /internet|online/i.test(b)) return false;
  if (/^(unknown|tbd|off|requested general)$/i.test(b)) return false;
  return !/^(tbd|unknown)$/i.test((room ?? "").trim());
}
