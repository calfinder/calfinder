import type { Course, Semester } from "../../lib/types";

export type WeekdayToken = "M" | "T" | "W" | "Tr" | "F";
export type TopTab = "discover" | "saved" | "search" | "editor" | "categories";

export type PreparedCourse = Course & {
  resolvedSemester: Semester;
  startMinutes: number;
  endMinutes: number;
  subjectCode: string;
  searchText: string;
};
