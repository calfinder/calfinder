export type Semester = "Fall 2026";

export const DEFAULT_SEMESTER: Semester = "Fall 2026";

export type Interest =
  | "Science & Nature"
  | "Tech & Engineering"
  | "Math & Data"
  | "Arts & Design"
  | "History & Culture"
  | "Society & Politics"
  | "Business & Economics"
  | "Health & Environment";

/** Stable catalog identity: subject + course number (e.g. COMPSCI + 61A → id COMPSCI-61A). */
export type CatalogEntry = {
  id: string;
  subject: string;
  courseNumber: string;
  title: string;
  description: string;
  department: string;
  interests: Interest[];
};

/** One section / time offering for a term. */
export type OfferingRow = {
  id: string;
  catalogId: string;
  semester: Semester;
  instructor: string;
  building: string;
  room: string;
  lat: number;
  lng: number;
  walkingMinutes: number;
  startTime: string;
  endTime: string;
  meetDays: string;
  enrolledCount: number | null;
  enrolledMax: number | null;
  waitlistedCount: number | null;
  enrollmentStatus: string | null;
};

/** Joined row used by the client UI (built on the server). */
export type Course = {
  id: string;
  title: string;
  code: string;
  department: string;
  instructor: string;
  building: string;
  room: string;
  startTime: string;
  endTime: string;
  meetDays: string;
  interests: Interest[];
  description: string;
  semester?: Semester;
  enrolledCount: number | null;
  enrolledMax: number | null;
  waitlistedCount: number | null;
  enrollmentStatus: string | null;
};
