import type { Course, Semester } from "../../lib/types";
import { DEFAULT_SEMESTER } from "../../lib/types";
import {
  BERKELEY_TZ,
  EARLIEST_MINUTES,
  EVENING_WINDOW_END_MINUTES,
  EVENING_WINDOW_START_MINUTES,
  LATEST_MINUTES,
  UC_BERKELEY_RMP_SCHOOL_ID
} from "./constants";
import type { WeekdayToken } from "./types";

export function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function snapToHalfHour(totalMinutes: number): number {
  let total = totalMinutes;
  const remainder = totalMinutes % 30;
  if (remainder < 15) total -= remainder;
  else total += 30 - remainder;
  return total;
}

export function getDefaultWeekdayToken(): WeekdayToken {
  const d = new Date().getDay();
  if (d === 1) return "M";
  if (d === 2) return "T";
  if (d === 3) return "W";
  if (d === 4) return "Tr";
  if (d === 5) return "F";
  return "M";
}

export function getDefaultMinutes(): number {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes >= EVENING_WINDOW_START_MINUTES && nowMinutes <= EVENING_WINDOW_END_MINUTES) return LATEST_MINUTES;
  if (nowMinutes < EARLIEST_MINUTES || nowMinutes > LATEST_MINUTES) return EARLIEST_MINUTES;
  return Math.max(EARLIEST_MINUTES, Math.min(LATEST_MINUTES, snapToHalfHour(nowMinutes)));
}

export function shouldUseNow(weekday: WeekdayToken, startMin: number): boolean {
  return weekday === getDefaultWeekdayToken() && startMin === getDefaultMinutes();
}

/** Parse meetDays string (e.g. MW, TTr) into tokens; Thursday is always Tr. */
export function tokenizeMeetDays(meetDays: string): WeekdayToken[] {
  const s = (meetDays || "").trim();
  const out: WeekdayToken[] = [];
  let i = 0;
  while (i < s.length) {
    if (s.slice(i, i + 2) === "Tr") {
      out.push("Tr");
      i += 2;
      continue;
    }
    const c = s[i];
    if (c === "M" || c === "T" || c === "W" || c === "F") {
      out.push(c as WeekdayToken);
    }
    i += 1;
  }
  return out;
}

export function meetDaysIncludes(meetDays: string, day: WeekdayToken): boolean {
  return tokenizeMeetDays(meetDays).includes(day);
}

const DAY_LABEL: Record<WeekdayToken, string> = { M: "M", T: "T", W: "W", Tr: "Th", F: "F" };
export function formatMeetDays(meetDays: string): string {
  return tokenizeMeetDays(meetDays).map(t => DAY_LABEL[t]).join(" ");
}

export function formatTimeRange(start: string, end: string) {
  const to12h = (t: string) => {
    const [hStr, m] = t.split(":");
    let h = Number(hStr);
    const suffix = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${suffix}`;
  };
  return `${to12h(start)} - ${to12h(end)}`;
}

export function stripPrereqText(description: string): string {
  if (!description) return description;
  const compact = description.replace(/\s+/g, " ").trim();

  // Remove trailing prerequisite/corequisite notes commonly appended to catalog descriptions.
  const cutPattern =
    /\b(prerequisites?|prereqs?|prerequisite\(s\)|corequisites?|corequisite\(s\)|pre[- ]?reqs?)\b/i;
  const match = compact.match(cutPattern);
  if (!match || match.index === undefined) return compact;

  return compact.slice(0, match.index).trim().replace(/[;:,.\-–\s]+$/g, "");
}

export function getDisplayDepartment(department: string, subject?: string): string {
  // For umbrella departments, resolve to the actual program by subject code
  if (department === "UG Interdisciplinary Studies") {
    const bySubject: Record<string, string> = {
      AMERSTD: "American Studies",
      MEDIAST: "Media Studies",
      DISSTD: "Disability Studies",
      ISF: "Interdisciplinary Studies",
      UGIS: "Interdisciplinary Studies",
      GWS: "Gender and Women's Studies",
      LS: "Letters and Science",
      EPS: "Earth and Planetary Science",
      UGBA: "Business Administration",
    };
    const s = (subject || "").toUpperCase();
    return bySubject[s] ?? "Interdisciplinary Studies";
  }

  const map: Record<string, string> = {
    // Agriculture & Resource
    "Ag & Resource Econ & Pol":        "Agricultural & Resource Economics and Policy",
    "Ag & Resource Economics":         "Agricultural & Resource Economics",
    // Ancient / Classical
    "Anc Hist Med Arc Grad Grp":       "Ancient History and Mediterranean Archaeology",
    "Ancient Greek & Roman Studies":   "Ancient Greek and Roman Studies",
    // Applied / Computational
    "Applied Sci & Tech Grad Grp":     "Applied Science and Technology",
    "Biophysics Grad Grp":             "Biophysics",
    "Buddhist Studies Grad Grp":       "Buddhist Studies",
    "Chem & Biomolecular Eng":         "Chemical and Biomolecular Engineering",
    "City & Regional Planning":        "City and Regional Planning",
    "Civil & Environmental Eng":       "Civil and Environmental Engineering",
    "Clg of Comp Data Sci & Soc":      "Computing, Data Science, and Society",
    "Comp Precision Health Grad Grp":  "Computational Precision Health",
    "Comp Social Science Grad Grp":    "Computational Social Science",
    "Comparative Biochem Grad Grp":    "Comparative Biochemistry",
    "Computational Biology Grad Grp":  "Computational Biology",
    "Data Science Undergrad Studies":  "Data Science",
    "Development Eng Grad Grp":        "Development Engineering",
    "Development Practice Grad Grp":   "Development Practice",
    "Earth & Planetary Science":       "Earth and Planetary Science",
    "East Asian Lang & Culture":       "East Asian Languages and Cultures",
    "Electrical Eng & Computer Sci":   "Electrical Engineering and Computer Sciences",
    "Energy & Resources Group":        "Energy and Resources",
    "Env Sci, Policy, & Mgmt":         "Environmental Science, Policy, and Management",
    "European Studies Grad Grp":       "European Studies",
    "Folklore Grad Grp":               "Folklore",
    "Gender & Womens Studies":         "Gender and Women's Studies",
    "Global Metro Std Grad Grp":       "Global Metropolitan Studies",
    "Goldman School Public Policy":    "Goldman School of Public Policy",
    "Grad School of Education":        "Graduate School of Education",
    "Grad School of Journalism":       "Graduate School of Journalism",
    "Health & Medical Sci Grad Grp":   "Health and Medical Sciences",
    "IAS Teaching Program":            "Interdisciplinary Arts and Sciences",
    "Industrial Eng & Ops Research":   "Industrial Engineering and Operations Research",
    "Industrial Eng & Operations Res": "Industrial Engineering and Operations Research",
    "Industrial Eng and Ops Research": "Industrial Engineering and Operations Research",
    "Inst of Urban & Reg Dev":         "Institute of Urban and Regional Development",
    "Interdisc Social Science Pgms":   "Interdisciplinary Social Science",
    "L&S Arts & Humanities Division":  "Arts and Humanities",
    "L&S Legal Studies":               "Legal Studies",
    "Landscape Arch & Env Plan":       "Landscape Architecture and Environmental Planning",
    "Materials Science & Eng":         "Materials Science and Engineering",
    "Middle Eastern Lang & Cultures":  "Middle Eastern Languages and Cultures",
    "Molecular & Cell Biology":        "Molecular and Cell Biology",
    "Nano Sci & Eng Grad Grp":         "Nanoscience and Engineering",
    "New Media Grad Grp":              "New Media",
    "Nutritional Sciences & Tox":      "Nutritional Sciences and Toxicology",
    "Optometry & Vision Science":      "Optometry and Vision Science",
    "Other Math & Physical Sci Pgms":  "Mathematics and Physical Sciences",
    "Plant & Microbial Biology":       "Plant and Microbial Biology",
    "Rausser Clg Natural Resources":   "Rausser College of Natural Resources",
    "Scandinavian":                    "Scandinavian Studies",
    "Sci & Tech Stds Grad Grp":        "Science and Technology Studies",
    "Science & Math Educ Grad Grp":    "Science and Mathematics Education",
    "Slavic Languages & Literatures":  "Slavic Languages and Literatures",
    "South & SE Asian Studies":        "South and Southeast Asian Studies",
    "Spanish & Portuguese":            "Spanish and Portuguese",
    "Theater Dance & Perf Stds":       "Theater, Dance, and Performance Studies",
    "Vision Science Grad Grp":         "Vision Science",
  };
  return map[department] ?? department;
}

export function getDisplayCollege(course: Course): string {
  const subject = (course.code.split(" ")[0] || "").toUpperCase();
  const rawDept = course.department;

  // Explicit department → college map (raw scraped department names as keys)
  const deptToCollege: Record<string, string> = {
    // Haas School of Business
    "Haas School of Business":            "Haas School of Business",

    // College of Chemistry
    "Chemistry":                          "College of Chemistry",
    "Chem & Biomolecular Eng":            "College of Chemistry",

    // College of Engineering
    "Bioengineering":                     "College of Engineering",
    "Civil & Environmental Eng":          "College of Engineering",
    "Electrical Eng & Computer Sci":      "College of Engineering",
    "Engineering":                        "College of Engineering",
    "Industrial Eng & Ops Research":      "College of Engineering",
    "Industrial Eng & Operations Res":    "College of Engineering",
    "Industrial Eng and Ops Research":    "College of Engineering",
    "Materials Science & Eng":            "College of Engineering",
    "Mechanical Engineering":             "College of Engineering",
    "Nuclear Engineering":                "College of Engineering",

    // College of Computing, Data Science & Society (CDSS)
    "Clg of Comp Data Sci & Soc":         "College of Computing, Data Science & Society",
    "Data Science Undergrad Studies":     "College of Computing, Data Science & Society",
    "School of Information":              "School of Information",

    // College of Environmental Design
    "Architecture":                       "College of Environmental Design",
    "City & Regional Planning":           "College of Environmental Design",
    "Landscape Arch & Env Plan":          "College of Environmental Design",
    "Inst of Urban & Reg Dev":            "College of Environmental Design",

    // Rausser College of Natural Resources
    "Env Sci, Policy, & Mgmt":            "Rausser College of Natural Resources",
    "Plant & Microbial Biology":          "Rausser College of Natural Resources",
    "Nutritional Sciences & Tox":         "Rausser College of Natural Resources",
    "Rausser Clg Natural Resources":      "Rausser College of Natural Resources",
    "Ag & Resource Economics":            "Rausser College of Natural Resources",
    "Ag & Resource Econ & Pol":           "Rausser College of Natural Resources",
    "Energy & Resources Group":           "Rausser College of Natural Resources",

    // Professional schools
    "School of Public Health":            "School of Public Health",
    "Goldman School Public Policy":       "Goldman School of Public Policy",
    "School of Optometry":                "School of Optometry",
    "Optometry & Vision Science":         "School of Optometry",
    "School of Social Welfare":           "School of Social Welfare",
    "Grad School of Education":           "Graduate School of Education",
    "Berkeley School of Education":       "Graduate School of Education",
    "Grad School of Journalism":          "Graduate School of Journalism",
  };

  if (deptToCollege[rawDept]) return deptToCollege[rawDept];

  // Subject-code overrides for ambiguous departments
  const subjectToCollege: Record<string, string> = {
    AEROENG:  "College of Engineering",
    MECENG:   "College of Engineering",
    ENGIN:    "College of Engineering",
    UGBA:     "Haas School of Business",
    ARCH:     "College of Environmental Design",
    CYPLAN:   "College of Environmental Design",
    LDARCH:   "College of Environmental Design",
    ESPM:     "Rausser College of Natural Resources",
    PLANTBI:  "Rausser College of Natural Resources",
    ENVECON:  "Rausser College of Natural Resources",
    NUSCTX:   "Rausser College of Natural Resources",
    COMPSCI:  "College of Computing, Data Science & Society",
    DATA:     "College of Computing, Data Science & Society",
    STAT:     "College of Computing, Data Science & Society",
    CDSS:     "College of Computing, Data Science & Society",
    INFO:     "School of Information",
    PBHLTH:   "School of Public Health",
    GPP:      "Goldman School of Public Policy",
    OPTOM:    "School of Optometry",
    EDUC:     "Graduate School of Education",
    JOURN:    "Graduate School of Journalism",
  };

  if (subjectToCollege[subject]) return subjectToCollege[subject];

  // Everything else is College of Letters & Science
  return "College of Letters & Science";
}

export function formatInstructor(instructor: string): string {
  if (!instructor || instructor.trim().length === 0) return "Staff";
  return instructor.replace(/^(Prof\.\s*|Professor\s+)/i, "");
}

export function rateMyProfessorSearchUrl(name: string): string {
  return `https://www.ratemyprofessors.com/search/professors/${UC_BERKELEY_RMP_SCHOOL_ID}?q=${encodeURIComponent(
    name.trim()
  )}`;
}

export function getCourseSemester(course: Course): Semester {
  return course.semester ?? DEFAULT_SEMESTER;
}

/** Scraped schedule text often drops “Hall” / “Building”; normalize for display and maps. */
export function formatBuildingLabel(raw: string): string {
  const key = raw.trim().replace(/\s+/g, " ");
  if (!key) return raw;

  const map: Record<string, string> = {
    "2240 Piedmont": "2240 Piedmont Ave",
    "2251 College": "ARF Building (Archaeological Research Facility)",
    "2401 Bancroft": "Bancroft Dance Studio",
    "2547 Bowditch": "Anna Head Alumnae Hall",
    "Anthro/Art Practice Bldg": "Anthro/Art Practice Building",
    Barker: "Barker Hall",
    Birge: "Birge Hall",
    Blum: "Blum Hall",
    Cheit: "Cheit Hall",
    "Chou Hall N540 and": "Chou Hall",
    Cory: "Cory Hall",
    Dwinelle: "Dwinelle Hall",
    Etcheverry: "Etcheverry Hall",
    Evans: "Evans Hall",
    GSPP: "Goldman Hall",
    "Genetics & Plant Bio": "Genetics & Plant Biology Building",
    "Haas Faculty Wing": "Haas Faculty Wing",
    "Hearst Field Annex": "Hearst Field Annex",
    "Hearst Mining": "Hearst Mining Building",
    Hertz: "Hertz Hall",
    "Internet/Online": "Internet/Online",
    "Jacobs Hall": "Jacobs Hall",
    "Joan and Sanford I. Weill": "Joan and Sanford I. Weill Hall",
    Latimer: "Latimer Hall",
    Lewis: "Lewis Hall",
    "Li Ka Shing": "Li Ka Shing Center",
    Morgan: "Morgan Hall",
    Morrison: "Morrison Hall",
    Mulford: "Mulford Hall",
    Off: "Off",
    "Physics Building": "Physics Building",
    Pimentel: "Pimentel Hall",
    "Social Sciences Building": "Social Sciences Building",
    Soda: "Soda Hall",
    Stanley: "Stanley Hall",
    Unknown: "Unknown",
    "Valley Life Sciences": "Valley Life Sciences Building",
    Wheeler: "Wheeler Hall",
    Wurster: "Wurster Hall"
  };

  if (map[key]) return map[key];

  if (
    /\b(Hall|Building|Bldg|Annex|Center|Wing|Plaza|Tower|House|Laboratory|Lab)\b/i.test(key)
  ) {
    return key;
  }

  return key;
}

export function buildMapsUrl(building: string) {
  const label = formatBuildingLabel(building);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${label}, UC Berkeley`
  )}`;
}

/** Today’s calendar date in Berkeley (for correct local class times). */
function getBerkeleyYmd(now: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BERKELEY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return { y, m, d };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO weekday for recurrence math: Mon=1 … Sun=7 (same as Temporal PlainDate.dayOfWeek). */
function tokenToIsoWeekday(t: WeekdayToken): number {
  const map: Record<WeekdayToken, number> = { M: 1, T: 2, W: 3, Tr: 4, F: 5 };
  return map[t];
}

function isoWeekdayMon1Sun7ForBerkeleyYmd(y: number, m: number, d: number): number {
  const PlainDate = globalThis.Temporal?.PlainDate;
  if (PlainDate) {
    return PlainDate.from({ year: y, month: m, day: d }).dayOfWeek;
  }
  for (let h = 0; h < 24; h += 1) {
    const trial = new Date(Date.UTC(y, m - 1, d, h, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: BERKELEY_TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric"
    }).formatToParts(trial);
    const yy = Number(parts.find((p) => p.type === "year")?.value);
    const mm = Number(parts.find((p) => p.type === "month")?.value);
    const dd = Number(parts.find((p) => p.type === "day")?.value);
    if (yy !== y || mm !== m || dd !== d) continue;
    const short = new Intl.DateTimeFormat("en-US", {
      timeZone: BERKELEY_TZ,
      weekday: "short"
    }).format(trial);
    const map: Record<string, number> = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[short] ?? 1;
  }
  const local = new Date(y, m - 1, d);
  const js = local.getDay();
  return js === 0 ? 7 : js;
}

/**
 * Next time this section meets in Berkeley civil time: first day on/after “now” in LA
 * whose weekday is in meetDays (e.g. MW + Sunday → Monday; MWF + Wednesday → Wednesday same day).
 */
function nextSessionBerkeleyYmd(meetDays: string, ref: Date): { y: number; m: number; d: number } {
  const tokens = tokenizeMeetDays(meetDays);
  const start = getBerkeleyYmd(ref);
  if (tokens.length === 0) {
    return start;
  }

  const want = new Set(tokens.map(tokenToIsoWeekday));
  const seen = new Set<string>();

  for (let i = 0; i < 56; i += 1) {
    const probe = new Date(ref.getTime() + i * 24 * 60 * 60 * 1000);
    const { y, m, d } = getBerkeleyYmd(probe);
    const key = `${y}-${m}-${d}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const dow = isoWeekdayMon1Sun7ForBerkeleyYmd(y, m, d);
    if (want.has(dow)) {
      return { y, m, d };
    }
  }

  return start;
}

export function meetDaysToRfcByDay(tokens: WeekdayToken[]): string | null {
  const map: Record<WeekdayToken, string> = {
    M: "MO",
    T: "TU",
    W: "WE",
    Tr: "TH",
    F: "FR"
  };
  const days = [...new Set(tokens.map((t) => map[t]).filter(Boolean))];
  if (days.length === 0) return null;
  return days.join(",");
}

/** Google Calendar template: dates are wall-clock times with ctz (Berkeley). */
function buildGoogleCalendarTemplateUrl(course: Course, repeat: "once" | "weekly"): string {
  const { y, m, d } = nextSessionBerkeleyYmd(course.meetDays || "", new Date());
  const ymd = `${y}${pad2(m)}${pad2(d)}`;
  const [sh, sm] = course.startTime.split(":").map(Number);
  const [eh, em] = course.endTime.split(":").map(Number);
  let endH = eh;
  let endM = em;
  const startMin = sh * 60 + sm;
  let endMin = endH * 60 + endM;
  if (endMin <= startMin) {
    endMin = startMin + 60;
    endH = Math.floor(endMin / 60);
    endM = endMin % 60;
  }

  const startSeg = `${ymd}T${pad2(sh)}${pad2(sm)}00`;
  const endSeg = `${ymd}T${pad2(endH)}${pad2(endM)}00`;
  const dates = `${startSeg}/${endSeg}`;

  const title = `${course.title} (${course.code})`;
  const location =
    `${formatBuildingLabel(course.building)}` +
    (course.room && course.room !== "TBD" ? `, Room ${course.room}` : "");

  const descLines = [
    stripPrereqText(course.description),
    course.instructor && course.instructor !== "Staff" ? `Instructor: ${course.instructor}` : "",
    course.meetDays ? `Scheduled meet pattern: ${course.meetDays}` : "",
    getCourseSemester(course) ? `Term: ${getCourseSemester(course)}` : "",
    "",
    repeat === "once"
      ? "One-time event. Adjust repeat or end date in Google Calendar if needed."
      : "Weekly recurrence suggested from CalFinder. Confirm repeat and end date in Google Calendar before saving."
  ].filter((line) => line !== "");
  const details = descLines.join("\n").slice(0, 3800);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
    details,
    location,
    ctz: BERKELEY_TZ
  });

  if (repeat === "weekly") {
    const byDay = meetDaysToRfcByDay(tokenizeMeetDays(course.meetDays));
    if (byDay) {
      params.set("recur", `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`);
    }
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function openGoogleCalendar(course: Course, repeat: "once" | "weekly") {
  const url = buildGoogleCalendarTemplateUrl(course, repeat);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Minutes since midnight from catalog "HH:MM". */
export function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesOverlapWindow(
  courseStartMin: number,
  courseEndMin: number,
  wStartMin: number,
  wEndMin: number
): boolean {
  return courseStartMin < wEndMin && courseEndMin > wStartMin;
}

export function formatMinutes12h(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function minutesToBarPercent(m: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((m - min) / (max - min)) * 100;
}
