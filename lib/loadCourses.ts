import fs from "node:fs/promises";
import path from "node:path";

import { hasPhysicalRoom, normalizeRoom, type RoomSlot } from "./rooms";
import type { CatalogEntry, Course, OfferingRow, Semester } from "./types";

let _cache: Course[] | null = null;
let _roomCache: RoomSlot[] | null = null;

export async function loadJoinedCourses(): Promise<Course[]> {
  if (_cache && process.env.NODE_ENV !== "development") return _cache;
  _cache = await _load();
  return _cache;
}

async function readData(): Promise<{ catalog: CatalogEntry[]; offerings: OfferingRow[] } | null> {
  const root = process.cwd();
  let catalogRaw: string;
  let offeringsRaw: string;
  try {
    [catalogRaw, offeringsRaw] = await Promise.all([
      fs.readFile(path.join(root, "data", "catalog.json"), "utf8"),
      fs.readFile(path.join(root, "data", "offerings.json"), "utf8")
    ]);
  } catch (err) {
    console.error("[loadCourses] Failed to read data files:", err);
    return null;
  }

  try {
    return { catalog: JSON.parse(catalogRaw), offerings: JSON.parse(offeringsRaw) };
  } catch (err) {
    console.error("[loadCourses] Failed to parse data JSON:", err);
    return null;
  }
}

async function _load(): Promise<Course[]> {
  const data = await readData();
  if (!data) return [];
  const { catalog, offerings } = data;

  const byCatalogId = new Map(catalog.map((c) => [c.id, c]));

  const isUndergrad = (entry: CatalogEntry) => {
    const m = entry.courseNumber.match(/^[A-Za-z]*(\d+)/);
    return m ? parseInt(m[1], 10) <= 199 : false;
  };

  const isNotProject = (entry: CatalogEntry) =>
    !/\bprojects?\b/i.test(entry.title) && !/\bcapstone\b/i.test(entry.title);

  const isNotLab = (entry: CatalogEntry) =>
    !/\blab(oratory|s)?\b/i.test(entry.title);

  const isNotBootcamp = (entry: CatalogEntry) =>
    !/\bbootcamps?\b/i.test(entry.title);

  const isNotSelectedTopics = (entry: CatalogEntry) =>
    !/\btopics?\b/i.test(entry.title);

  return offerings
    .filter((o) => !/internet|online/i.test(o.building ?? ""))
    .filter((o) => {
      const cat = byCatalogId.get(o.catalogId);
      return cat ? isUndergrad(cat) && isNotProject(cat) && isNotLab(cat) && isNotBootcamp(cat) && isNotSelectedTopics(cat) : false;
    })
    .map((o) => {
    const cat = byCatalogId.get(o.catalogId)!;
    return {
      id: String(o.id),
      code: `${cat.subject} ${cat.courseNumber}`,
      title: cat.title,
      description: cat.description,
      department: cat.department,
      interests: cat.interests,
      instructor: o.instructor,
      building: o.building,
      room: o.room,
      startTime: o.startTime,
      endTime: o.endTime,
      meetDays: o.meetDays,
      semester: o.semester as Semester,
      enrolledCount: o.enrolledCount ?? null,
      enrolledMax: o.enrolledMax ?? null,
      waitlistedCount: o.waitlistedCount ?? null,
      enrollmentStatus: o.enrollmentStatus ?? null
    };
  });
}

/**
 * Every in-person lecture time in every room, graduate and small classes included, so the room
 * view can show when a room is in use. Cross-listed copies (DATA C100 / STAT C100 / DATA C200 ...)
 * share a room and time and become one slot, named after the most-enrolled copy.
 */
export async function loadRoomSchedule(): Promise<RoomSlot[]> {
  if (_roomCache && process.env.NODE_ENV !== "development") return _roomCache;
  const data = await readData();
  if (!data) return [];

  const byCatalogId = new Map(data.catalog.map((c) => [c.id, c]));
  const slots = new Map<string, OfferingRow[]>();
  for (const o of data.offerings) {
    if (!byCatalogId.has(o.catalogId) || !hasPhysicalRoom(o.building, o.room)) continue;
    const slot = [normalizeRoom(o.building, o.room).key, o.meetDays, o.startTime, o.endTime].join("|");
    if (!slots.has(slot)) slots.set(slot, []);
    slots.get(slot)!.push(o);
  }

  _roomCache = [...slots.values()].map((copies) => {
    const main = copies.reduce((a, b) => ((b.enrolledCount ?? 0) > (a.enrolledCount ?? 0) ? b : a));
    const cat = byCatalogId.get(main.catalogId)!;
    return {
      ids: copies.map((o) => String(o.id)),
      code: `${cat.subject} ${cat.courseNumber}`,
      title: cat.title,
      building: main.building,
      room: main.room,
      meetDays: main.meetDays,
      startTime: main.startTime,
      endTime: main.endTime
    };
  });
  return _roomCache;
}
