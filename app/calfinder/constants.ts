import type { Interest } from "../../lib/types";
import type { WeekdayToken } from "./types";

export const INTEREST_OPTIONS: Interest[] = [
  "Business & Economics",
  "Society & Politics",
  "History & Culture",
  "Health & Environment",
  "Arts & Design",
  "Science & Nature",
  "Tech & Engineering",
  "Math & Data"
];

export const EARLIEST_MINUTES = 8 * 60; // 8:00 AM
export const LATEST_MINUTES = 19 * 60; // 7:00 PM
export const LOCKED_WINDOW_MINUTES = 60;
export const EXCLUDED_BUILDINGS = new Set(["Internet/Online", "Off", "Unknown"]);

// Evening window: if the user opens the app between 7:30–9 PM we snap to 7 PM
export const EVENING_WINDOW_START_MINUTES = 19 * 60 + 30; // 7:30 PM
export const EVENING_WINDOW_END_MINUTES = 21 * 60;        // 9:00 PM

export const UC_BERKELEY_RMP_SCHOOL_ID = "1072";

export const MIN_CLASS_CAPACITY = 24;

export const CAMPUS_AREAS: Record<string, Set<string>> = {
  Southside: new Set(["Dwinelle", "Hearst Field Annex", "Social Sciences Building", "Wheeler"]),
  Northside: new Set(["Blum", "Cory", "Etcheverry", "Evans", "GSPP", "Hearst Mining", "Jacobs Hall", "Soda", "Stanley"]),
  Eastside: new Set(["Anthro/Art Practice Bldg", "Birge", "Cheit", "Chou Hall", "Chou Hall N540 and", "Haas Faculty Wing", "Hertz", "Latimer", "Lewis", "Morrison", "Physics Building", "Pimentel", "Wurster"]),
  Westside: new Set(["Barker", "Genetics & Plant Bio", "Joan and Sanford I. Weill", "Li Ka Shing", "Morgan", "Mulford", "Valley Life Sciences"]),
};

export const WEEKDAY_BUTTONS: { token: WeekdayToken; label: string }[] = [
  { token: "M", label: "M" },
  { token: "T", label: "T" },
  { token: "W", label: "W" },
  { token: "Tr", label: "Th" },
  { token: "F", label: "F" }
];

export const DAY_LABEL: Record<WeekdayToken, string> = { M: "M", T: "T", W: "W", Tr: "Th", F: "F" };

export const BERKELEY_TZ = "America/Los_Angeles";
