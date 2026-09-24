"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { Course, Interest, Semester } from "../lib/types";
import { DEFAULT_SEMESTER } from "../lib/types";
import { CalendarModal } from "./calfinder/CalendarModal";
import { CategoriesTab } from "./calfinder/CategoriesTab";
import {
  CAMPUS_AREAS,
  EARLIEST_MINUTES,
  EXCLUDED_BUILDINGS,
  INTEREST_OPTIONS,
  LATEST_MINUTES,
  LOCKED_WINDOW_MINUTES,
  MIN_CLASS_CAPACITY,
  WEEKDAY_BUTTONS
} from "./calfinder/constants";
import { DiscoverTab } from "./calfinder/DiscoverTab";
import { EditorTab } from "./calfinder/EditorTab";
import {
  downloadJsonFile,
  formatBuildingLabel,
  formatMinutes12h,
  getCourseSemester,
  getDefaultMinutes,
  getDefaultWeekdayToken,
  meetDaysIncludes,
  minutesOverlapWindow,
  shouldUseNow,
  shuffleArray,
  snapToHalfHour,
  timeStringToMinutes
} from "./calfinder/helpers";
import { SavedTab } from "./calfinder/SavedTab";
import { SearchTab } from "./calfinder/SearchTab";
import type { PreparedCourse, TopTab, WeekdayToken } from "./calfinder/types";

// Editor tools (stats + database download) are hidden from the app UI.
const SHOW_EDITOR = false;

// Minimum size of the free-time window, in minutes.
const FREE_RANGE_MIN_GAP = 30;

export function CalFinderClient({ initialCourses }: { initialCourses: Course[] }) {
  const preparedCourses = useMemo(
    () =>
      initialCourses.map((c) => ({
        ...c,
        id: String(c.id),
        meetDays: c.meetDays ?? "MW",
        resolvedSemester: getCourseSemester(c),
        startMinutes: timeStringToMinutes(c.startTime),
        endMinutes: timeStringToMinutes(c.endTime),
        subjectCode: (c.code.split(" ")[0] || "").toUpperCase(),
        searchText: `${c.title} ${c.code} ${c.instructor} ${c.department} ${c.description}`.toLowerCase()
      })),
    [initialCourses]
  ) as PreparedCourse[];

  const allCourses = useMemo(
    () => preparedCourses.filter((c) => c.enrolledMax === null || c.enrolledMax >= MIN_CLASS_CAPACITY),
    [preparedCourses]
  );

  const undersizedCourses = useMemo(
    () => preparedCourses.filter((c) => c.enrolledMax !== null && c.enrolledMax < MIN_CLASS_CAPACITY),
    [preparedCourses]
  );

  const semester: Semester = DEFAULT_SEMESTER;
  const [topTab, setTopTab] = useState<TopTab>("discover");
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayToken>("M");
  const [freeRangeStartMinutes, setFreeRangeStartMinutes] = useState(EARLIEST_MINUTES);
  const [freeRangeEndMinutes, setFreeRangeEndMinutes] = useState(
    EARLIEST_MINUTES + LOCKED_WINDOW_MINUTES
  );
  const [usingNow, setUsingNow] = useState(true);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [currentSearchSection, setCurrentSearchSection] = useState<string | null>(null);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [lastPool, setLastPool] = useState<Course[]>([]);
  const [page, setPage] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultsKey, setResultsKey] = useState(0);
  const [sortCol, setSortCol] = useState<"code" | "enrollment" | null>("enrollment");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pendingCalendarCourse, setPendingCalendarCourse] = useState<Course | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileShowResults, setMobileShowResults] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set<string>());

  // Hydration-safe defaults: compute time-based selections only on the client.
  useEffect(() => {
    const weekday = getDefaultWeekdayToken();
    const startM = Math.min(getDefaultMinutes(), LATEST_MINUTES - LOCKED_WINDOW_MINUTES);
    setSelectedWeekday(weekday);
    setFreeRangeStartMinutes(startM);
    setFreeRangeEndMinutes(Math.min(LATEST_MINUTES, startM + LOCKED_WINDOW_MINUTES));
    setUsingNow(shouldUseNow(weekday, startM));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("calfinder-saved");
      setSavedIds(new Set<string>(raw ? JSON.parse(raw) : []));
    } catch {
      // localStorage unavailable (private browsing, quota, etc.) — start with empty saved list
      setSavedIds(new Set<string>());
    }
  }, []);

  const savedCourses = useMemo(
    () => allCourses.filter((c) => savedIds.has(c.id)),
    [allCourses, savedIds]
  );

  function toggleSave(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try {
        localStorage.setItem("calfinder-saved", JSON.stringify([...next]));
      } catch {
        console.warn("[CalFinder] Could not persist saved courses to localStorage.");
      }
      return next;
    });
  }

  const freeRangeValid = freeRangeStartMinutes < freeRangeEndMinutes;

  const applyFreeRange = useCallback(
    (nextStart: number, nextEnd: number) => {
      let s = Math.round(nextStart);
      let e = Math.round(nextEnd);
      s = Math.max(EARLIEST_MINUTES, Math.min(s, LATEST_MINUTES - FREE_RANGE_MIN_GAP));
      e = Math.min(LATEST_MINUTES, Math.max(e, s + FREE_RANGE_MIN_GAP));
      setFreeRangeStartMinutes(s);
      setFreeRangeEndMinutes(e);
      setUsingNow(shouldUseNow(selectedWeekday, s));
    },
    [selectedWeekday]
  );

  const filteredCourses = useMemo(() => {
    if (!freeRangeValid) return [];
    let wStart = freeRangeStartMinutes;
    let wEnd = freeRangeEndMinutes;
    if (wStart > wEnd) [wStart, wEnd] = [wEnd, wStart];
    return allCourses.filter((course) => {
      if (course.resolvedSemester !== semester) return false;
      if (!meetDaysIncludes(course.meetDays, selectedWeekday)) return false;
      if (selectedInterests.length > 0 && !course.interests.some((i) => selectedInterests.includes(i))) return false;
      if (selectedArea && !CAMPUS_AREAS[selectedArea]?.has(course.building)) return false;
      if (selectedBuilding && course.building !== selectedBuilding && !(selectedBuilding === "Chou Hall" && course.building === "Chou Hall N540 and")) return false;
      return minutesOverlapWindow(course.startMinutes, course.endMinutes, wStart, wEnd);
    });
  }, [
    allCourses,
    freeRangeEndMinutes,
    freeRangeStartMinutes,
    freeRangeValid,
    selectedArea,
    selectedBuilding,
    selectedInterests,
    semester,
    selectedWeekday
  ]);

  const uniqueCourseCount = useMemo(
    () => new Set(allCourses.map((course) => course.code)).size,
    [allCourses]
  );
  const semesterCourses = useMemo(
    () => allCourses.filter((course) => course.resolvedSemester === semester),
    [allCourses, semester]
  );
  const dayMatchedCourses = useMemo(
    () => semesterCourses.filter((course) => meetDaysIncludes(course.meetDays, selectedWeekday)),
    [semesterCourses, selectedWeekday]
  );
  const interestMatchedCourses = useMemo(() => {
    if (selectedInterests.length === 0) return dayMatchedCourses;
    return dayMatchedCourses.filter((course) =>
      course.interests.some((interest) => selectedInterests.includes(interest))
    );
  }, [dayMatchedCourses, selectedInterests]);

  const searchGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const matched = allCourses.filter((c) => {
      if (c.resolvedSemester !== semester) return false;
      return tokens.every((token) => c.searchText.includes(token));
    });
    const map = new Map<string, Course[]>();
    for (const c of matched) {
      const key = c.code || c.title;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).map(([code, sections]) => ({ code, sections }));
  }, [searchQuery, allCourses, semester]);

  function toggleExpandCode(code: string, sections: Course[]) {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        setCurrentSearchSection(null);
      } else {
        next.add(code);
        if (sections.length === 1) setCurrentSearchSection(sections[0].id);
      }
      return next;
    });
  }

  function handleNow() {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let startM: number;

    // If current time is 7:30 PM to 9:00 PM, pin to 7:00 PM.
    if (nowMinutes >= 19 * 60 + 30 && nowMinutes <= 21 * 60) {
      startM = LATEST_MINUTES;
    } else if (nowMinutes < EARLIEST_MINUTES || nowMinutes > LATEST_MINUTES) {
      // Any other out-of-range time maps to 7:00 AM.
      startM = EARLIEST_MINUTES;
    } else {
      startM = snapToHalfHour(nowMinutes);
      startM = Math.max(EARLIEST_MINUTES, Math.min(LATEST_MINUTES, startM));
    }

    const weekday = getDefaultWeekdayToken();
    setSelectedWeekday(weekday);
    startM = Math.min(startM, LATEST_MINUTES - LOCKED_WINDOW_MINUTES);
    const endM = Math.min(LATEST_MINUTES, startM + LOCKED_WINDOW_MINUTES);
    setFreeRangeStartMinutes(startM);
    setFreeRangeEndMinutes(endM);
    setUsingNow(shouldUseNow(weekday, startM));
  }

  function toggleInterest(interest: Interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  const sortedPool = useMemo(() => {
    if (!sortCol) return lastPool;
    if (sortCol === "enrollment") {
      return [...lastPool].sort((a, b) =>
        sortDir === "desc"
          ? (a.enrolledMax ?? 0) - (b.enrolledMax ?? 0)
          : (b.enrolledMax ?? 0) - (a.enrolledMax ?? 0)
      );
    }
    return [...lastPool].sort((a, b) => {
      const va = (a as PreparedCourse).subjectCode;
      const vb = (b as PreparedCourse).subjectCode;
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [lastPool, sortCol, sortDir]);

  useEffect(() => {
    setPage(0);
  }, [lastPool, sortCol, sortDir]);

  function handleSort(col: "code" | "enrollment") {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function buildPool(courses: Course[]) {
    const shuffled = shuffleArray(courses);
    shuffled.sort((a, b) => {
      const aExact = (a as PreparedCourse).startMinutes === freeRangeStartMinutes ? 0 : 1;
      const bExact = (b as PreparedCourse).startMinutes === freeRangeStartMinutes ? 0 : 1;
      return aExact - bExact;
    });
    if (selectedInterests.length > 0) {
      const interestSet = new Set(selectedInterests);
      const scoreCache = new Map<string, { count: number; pure: boolean }>();
      const getScore = (course: Course) => {
        const cached = scoreCache.get(course.id);
        if (cached) return cached;
        let count = 0; let pure = true;
        for (const interest of course.interests) {
          if (interestSet.has(interest)) count += 1; else pure = false;
        }
        const score = { count, pure };
        scoreCache.set(course.id, score);
        return score;
      };
      shuffled.sort((a, b) => {
        const aExact = (a as PreparedCourse).startMinutes === freeRangeStartMinutes ? 0 : 1;
        const bExact = (b as PreparedCourse).startMinutes === freeRangeStartMinutes ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aScore = getScore(a); const bScore = getScore(b);
        if (bScore.count !== aScore.count) return bScore.count - aScore.count;
        return (aScore.pure ? 0 : 1) - (bScore.pure ? 0 : 1);
      });
    }
    return shuffled;
  }

  function handleFindClass() {
    setCurrentCourse(null);
    setHasSearched(true);
    setPage(0);
    setSortCol("enrollment");
    setSortDir("asc");
    setResultsKey((k) => k + 1);
    setMobileShowResults(true);
    setLastPool(buildPool(filteredCourses));
  }

  function handleDownloadDatabase() {
    downloadJsonFile("calfinder-joined-courses.json", allCourses);
  }

  return (
    <>
      <style jsx global>{`
        :root { --navy:#000; --navy-light:#333; --gold:#fff; --gold-dim:#525252; --bg:#fafafa; --cream:#fafafa; --cream-dark:#f2f2f2; --text:#000; --muted:#666; --border:#eaeaea; --chip-bg:#fff; --surface:#fff; --font-display:var(--font-instrument-serif),Georgia,"Times New Roman",serif; --font-body:var(--font-geist-sans),system-ui,sans-serif; --font-mono:var(--font-geist-mono),ui-monospace,monospace; --radius-sm:6px; --radius-md:8px; --radius-lg:12px; --radius-pill:999px; --shadow-sm:0 1px 2px rgba(0,0,0,.04); --shadow-md:0 2px 6px rgba(0,0,0,.06); --shadow-lg:0 8px 24px rgba(0,0,0,.10);}

        .redesign-root,.redesign-root *{box-sizing:border-box}.redesign-root{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--text);font-family:var(--font-body)}
        body,body *{transition:background-color 300ms ease,color 300ms ease,border-color 300ms ease,box-shadow 300ms ease;}
        .redesign-root nav{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem 1.75rem;border:none;border-bottom:1px solid var(--border);background:rgba(255,255,255,.8);-webkit-backdrop-filter:saturate(180%) blur(12px);backdrop-filter:saturate(180%) blur(12px);border-radius:0;box-shadow:none;position:sticky;top:0;z-index:30;max-width:none;width:100%;margin:0}
        .logo{display:flex;align-items:center;gap:.5rem;text-decoration:none}.logo-mark{width:32px;height:32px;background:var(--navy);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center}.logo-wordmark{font-weight:500;font-size:1rem;color:var(--navy);letter-spacing:-.01em}
        .header-right{display:flex;align-items:center;gap:.75rem}
        .top-tabs{display:flex;align-items:center;gap:2px;border:1px solid var(--border);border-radius:var(--radius-pill);background:var(--cream-dark);padding:3px}
        .top-tab-btn{font-family:var(--font-body);font-size:.8rem;letter-spacing:0;color:var(--muted);background:transparent;border:none;border-radius:var(--radius-pill);padding:.45rem .95rem;cursor:pointer;transition:color 140ms ease,background-color 140ms ease}
        .top-tab-btn:hover{color:var(--text)}
        .top-tab-btn.active{background:#fff;color:var(--navy);font-weight:500;box-shadow:var(--shadow-sm)}
        .semester-toggle{display:flex;align-items:center;border-radius:var(--radius-pill);background:#fff;border:1px solid var(--border);padding:3px}
        .semester-badge{font-family:var(--font-body);font-size:.78rem;letter-spacing:0;color:var(--navy);font-weight:500;border-radius:var(--radius-pill);padding:.4rem .8rem;box-shadow:var(--shadow-sm);cursor:default;user-select:none}
        .redesign-main{flex:1;max-width:1200px;width:100%;margin:0 auto;padding:2.5rem 1.25rem 6rem;overflow-x:hidden}
        .hero-title,.subheadline,.description,.form-section{max-width:960px}.hero-title,.subheadline,.description,.form-section,.cta-wrapper{animation:float-in 520ms cubic-bezier(.16,1,.3,1) both}.subheadline{animation-delay:60ms}.description{animation-delay:110ms}.cta-wrapper{animation-delay:160ms}@keyframes float-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .eyebrow{font-family:var(--font-body);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:1.5rem}
        .hero-title{font-family:var(--font-display);font-size:clamp(2.6rem,6vw,3.75rem);font-weight:600;line-height:1.05;color:var(--text);letter-spacing:-.04em;margin-bottom:.9rem}.subheadline{font-family:var(--font-display);font-size:clamp(1.2rem,3vw,1.5rem);font-weight:400;font-style:normal;color:var(--muted);letter-spacing:-.02em;margin-bottom:1.75rem}.description{font-size:1rem;line-height:1.75;color:var(--muted);max-width:520px;margin-bottom:3.5rem}
        .divider{height:1px;background:var(--border);margin:3rem 0}.form-section{margin-bottom:2.5rem}.section-label{display:flex;align-items:center;gap:.75rem;margin-bottom:1rem}.step-number{font-family:var(--font-mono);font-size:.7rem;font-weight:500;color:var(--on-accent);background:var(--accent);border:none;border-radius:7px;padding:0 .1rem;letter-spacing:.01em;line-height:1;display:inline-flex;align-items:center;justify-content:center;height:1.55rem;min-width:1.85rem;box-shadow:0 1px 2px rgba(0,0,0,.18)}.section-title{font-family:var(--font-display);font-size:1.95rem;font-weight:400;letter-spacing:-.01em;text-transform:none;color:var(--text)}
        .when-section{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;column-gap:1.25rem;row-gap:.75rem}.when-section .section-label{grid-column:1;grid-row:1;align-self:center;margin-bottom:0}.when-section .time-range-block{grid-column:1/-1;grid-row:2}.when-section .day-strip{grid-column:2;grid-row:1;align-self:center}.when-free-row{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;flex:1;min-width:0}.when-free-row .day-btn.when-now-btn{flex:0 0 auto;white-space:nowrap}.when-free-row .day-btn.when-now-btn:hover:not(.active){background:rgba(0,0,0,.04)}
        .time-range-block{display:flex;align-items:flex-start;gap:.85rem;width:100%;min-width:0;flex:1}
        .time-range-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:.35rem}
        .label-opt{opacity:0.45;font-size:.85em}
        .chip.active,.time-btn.active,.day-btn.active{box-shadow:none}.chip,.day-btn,.time-btn{transition:transform 140ms ease,border-color 140ms ease,background-color 140ms ease,color 140ms ease,box-shadow 140ms ease}.chip:hover:not(.active),.day-btn:hover:not(.active),.time-btn:hover:not(.active){transform:translateY(-1px);border-color:rgba(0,0,0,.3);box-shadow:var(--shadow-sm)}
        .dual-range-thumb.is-dragging{cursor:grabbing;box-shadow:0 0 0 4px rgba(0,0,0,.08),var(--shadow-md)}.dual-range-bubble{position:absolute;bottom:calc(50% + 20px);left:50%;transform:translateX(-50%);background:var(--navy);color:#fff;font-family:var(--font-mono);font-size:.72rem;letter-spacing:.02em;padding:.25rem .55rem;border-radius:var(--radius-sm);white-space:nowrap;pointer-events:none;box-shadow:var(--shadow-md);z-index:6}.dual-range-bubble::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:var(--navy)}
        .time-range-dual{flex:1;min-width:0;display:flex;flex-direction:column;gap:.45rem}
        .dual-range{position:relative;height:56px;width:100%;align-self:stretch;cursor:pointer}
        .dual-range-bg{position:absolute;left:0;right:0;top:50%;height:8px;margin-top:-4px;border-radius:999px;background:#eaeaea;pointer-events:none}
        .dual-range-fill{position:absolute;top:50%;height:8px;margin-top:-4px;border-radius:999px;background:var(--navy);min-width:0;cursor:grab;z-index:1}
        .dual-range-thumb{position:absolute;top:50%;z-index:2;width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid var(--navy);box-shadow:var(--shadow-md);transform:translate(-50%,-50%);cursor:grab;padding:0;transition:box-shadow 140ms ease}
        .dual-range-thumb--end{z-index:3}
        .dual-range-thumb:hover,.dual-range-thumb:focus-visible{z-index:4;outline:none;box-shadow:0 0 0 4px rgba(0,0,0,.08),var(--shadow-md)}
        .dual-range-thumb:active{cursor:grabbing}
        .time-range-readout-line{margin:0;font-family:var(--font-mono);font-size:.85rem;letter-spacing:.02em;color:var(--text);background:var(--cream-dark);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.35rem .9rem;white-space:nowrap;width:fit-content;align-self:center}
        .time-range-sep{opacity:0.45;padding:0 .35rem}
        .day-strip{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:.45rem}.day-btn{font-family:var(--font-body);font-size:.9rem;border:1px solid var(--border);background:var(--chip-bg);color:var(--text);padding:.55rem 1rem;border-radius:var(--radius-pill);cursor:pointer}.day-btn.active{background:var(--navy);color:var(--gold);border-color:var(--navy)}
        .time-row{display:flex;align-items:center;gap:.8rem}.time-btn,.chip{font-family:var(--font-body);font-size:.9rem;border:1px solid var(--border);background:var(--chip-bg);color:var(--text);padding:.55rem 1rem;border-radius:var(--radius-pill);cursor:pointer}.time-btn.active,.chip.active{background:var(--navy);color:var(--gold);border-color:var(--navy)}
        .time-slider-wrap{flex:1;display:flex;align-items:center;gap:.75rem;min-width:220px}.time-slider{flex:1;appearance:none;height:6px;border-radius:999px;background:rgba(0,40,85,.15);outline:none}.time-slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:var(--navy);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}.time-slider::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--navy);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}
        .time-readout{font-family:var(--font-mono);font-size:.78rem;color:var(--muted);min-width:72px;text-align:right}
        .chips{display:flex;flex-wrap:wrap;gap:.5rem}.building-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem;animation:chips-in 180ms ease both}@keyframes chips-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}.chip--sm{font-size:.78rem;padding:.35rem .75rem}.cta-wrapper{margin-top:3rem}.cta-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:.75rem;background:var(--navy);color:var(--gold);border:none;border-radius:var(--radius-md);padding:1.05rem 2rem;font-family:var(--font-body);font-size:.82rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:var(--shadow-md);transition:transform 160ms ease,box-shadow 160ms ease}.cta-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:var(--shadow-lg)}.cta-btn:disabled{opacity:.6;cursor:not-allowed}
        .prominent-message{text-align:center;font-family:var(--font-display);font-size:clamp(1.35rem,3.6vw,1.9rem);line-height:1.28;color:var(--navy);letter-spacing:-.01em}.prominent-message--form{margin-top:3rem}.prominent-message--result{margin-top:1.25rem}.result-section{margin-top:3rem;animation:results-fade-in 280ms ease both}@keyframes results-fade-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.result-label{font-family:var(--font-body);font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem}
        .course-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-md)}.card-body{padding:1.5rem 1.75rem}.card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1rem}.card-college{font-family:var(--font-display);font-size:1.2rem;line-height:1.25;color:var(--navy);margin:0 0 .3rem}.card-dept{font-family:var(--font-body);font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
        .card-time-badge{font-family:var(--font-mono);font-size:.7rem;color:var(--muted);background:var(--cream-dark);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.25rem .7rem;white-space:nowrap}.card-title{font-family:var(--font-display);font-size:clamp(1.3rem,3vw,1.65rem);font-weight:500;line-height:1.2;letter-spacing:-.02em;color:var(--text);margin-bottom:.4rem}
        .card-meta,.card-desc{color:var(--muted);font-size:.86rem;line-height:1.65;margin-bottom:1rem}.card-instructor-link{color:var(--text);text-decoration:none;font-weight:500;border-bottom:1px solid rgba(0,0,0,.2)}.card-instructor-link:hover{border-bottom-color:var(--text)}.card-divider{height:1px;background:var(--border);margin:1.25rem 0}.card-location{margin-bottom:1.25rem}.card-location a{color:var(--text);text-decoration:none;font-weight:500;border-bottom:1px solid rgba(0,0,0,.2)}.card-location a:hover{border-bottom-color:var(--text)}
        .rt-classsize{font-family:var(--font-mono);font-size:.75rem;color:var(--text);white-space:nowrap}
        .card-tags{display:flex;flex-wrap:wrap;gap:.4rem}.card-tag{font-family:var(--font-body);font-size:.72rem;letter-spacing:0;text-transform:none;color:var(--muted);background:var(--cream);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.25rem .65rem}
        .card-actions{display:flex;justify-content:flex-end;gap:.6rem;padding:1rem 1.75rem;border-top:1px solid var(--border);background:var(--cream)}.btn-secondary,.btn-primary{font-family:var(--font-body);font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;border-radius:var(--radius-sm);padding:.6rem 1.1rem;cursor:pointer}.btn-secondary{color:var(--navy);background:transparent;border:1px solid var(--border)}.btn-primary{color:var(--gold);background:var(--navy);border:1px solid var(--navy)}
        .save-btn{background:none;border:none;cursor:pointer;padding:.25rem .4rem;line-height:1;color:var(--muted);opacity:.4;transition:opacity 120ms,color 120ms;vertical-align:middle}.save-btn:hover{opacity:1;color:var(--gold-dim)}.save-btn.is-saved{color:var(--gold-dim);opacity:1}
        .saved-badge{display:inline-flex;align-items:center;justify-content:center;background:var(--navy);color:var(--gold);border-radius:var(--radius-pill);font-size:.55rem;font-weight:700;min-width:14px;height:14px;padding:0 3px;margin-left:4px;line-height:1}
        .saved-empty{text-align:center;padding:4rem 2rem;color:var(--muted);font-family:var(--font-display);font-size:1.1rem;font-weight:400;font-style:normal}
        .results-table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);background:var(--surface)}
        .results-table{width:100%;border-collapse:collapse;background:#fff}
        .results-table thead tr{background:var(--cream-dark);border-bottom:1px solid var(--border)}
        .results-table thead th{font-family:var(--font-body);font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:.75rem 1rem;text-align:left;font-weight:500;white-space:nowrap}
        .results-table thead th.sortable{cursor:pointer;user-select:none}
        .results-table thead th.sortable:hover{color:var(--text)}
        .sort-arrow{margin-left:.35rem;opacity:.7}
        .results-table tbody tr{cursor:pointer;border-top:1px solid var(--border);transition:background 100ms}
        .results-table tbody tr:hover{background:rgba(0,0,0,.03)}
        .results-table td{padding:.65rem 1rem;vertical-align:middle}
        .rt-code{font-family:var(--font-mono);font-size:.7rem;color:var(--muted);white-space:nowrap}
        .rt-title{font-size:.85rem;font-weight:500;color:var(--navy)}
        .rt-instructor{font-size:.82rem;color:var(--muted);white-space:nowrap}
        .rt-time{font-family:var(--font-mono);font-size:.7rem;color:var(--muted);white-space:nowrap}
        .rt-location{font-size:.8rem;color:var(--muted)}
        .rt-tags{display:flex;flex-wrap:wrap;gap:.25rem}
        .rt-tag{font-size:.65rem;color:var(--muted);background:var(--cream);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.15rem .5rem;white-space:nowrap}
        .result-count{font-family:var(--font-body);font-size:.75rem;letter-spacing:0;color:var(--muted);margin-bottom:.75rem}
        .results-table tbody tr.row-active{background:rgba(0,0,0,.04)}
        .results-table tbody tr.row-active td{border-bottom:none}
        .expanded-row>td{padding:0;border-bottom:2px solid var(--border)}
        .expanded-card-wrap{padding:1.5rem 2rem;background:var(--cream);border-top:1px solid var(--border)}
        .expanded-card-wrap .course-card{width:100%}
        .category-table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-md);background:#fff}
        .category-table{width:100%;border-collapse:collapse}
        .category-table thead{background:var(--cream-dark);border-bottom:1px solid var(--border)}
        .category-table thead th{font-family:var(--font-body);font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:.75rem 1rem;text-align:left;font-weight:500}
        .category-table tbody tr{border-top:1px solid var(--border)}
        .category-table tbody tr:nth-child(even){background:rgba(0,0,0,.02)}
        .category-table td{padding:.85rem 1rem;vertical-align:top}
        .category-name{font-family:var(--font-mono);font-size:.78rem;color:var(--navy);white-space:nowrap}
        .category-covers{font-size:.85rem;line-height:1.6;color:var(--muted);margin-bottom:.4rem}
        .category-examples{display:flex;flex-wrap:wrap;gap:.3rem}
        .category-example-pill{font-family:var(--font-mono);font-size:.65rem;color:var(--muted);background:var(--cream);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.15rem .55rem}
        .editor-panel{background:#fff;border:1px solid var(--border);border-radius:var(--radius-md);padding:1.25rem 1.5rem;margin-top:1.5rem}
        .editor-title{font-family:var(--font-body);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem}
        .editor-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}
        .editor-stat{border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem .85rem;background:var(--cream)}
        .editor-stat-label{font-family:var(--font-body);font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:.4rem}
        .editor-stat-value{font-family:var(--font-display);font-size:1.5rem;line-height:1;color:var(--navy)}
        .editor-actions{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;margin-top:1rem}
        .editor-button{font-family:var(--font-body);font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;border-radius:var(--radius-sm);padding:.58rem .95rem;cursor:pointer;color:var(--gold);background:var(--navy);border:1px solid var(--navy)}
        .editor-note{font-size:.82rem;line-height:1.5;color:var(--muted);margin-top:.8rem}
        .pagination{display:flex;align-items:center;justify-content:center;margin-top:1.5rem;gap:.6rem}
        .page-btn{display:flex;align-items:center;justify-content:center;background:var(--navy);color:var(--gold);border:none;border-radius:var(--radius-md);padding:1.05rem 2rem;font-family:var(--font-mono);font-size:.8rem;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}
        .page-btn:hover:not(:disabled){background:var(--navy-light)}
        .page-btn:disabled{opacity:.35;cursor:not-allowed}
        .page-info{font-family:var(--font-body);font-size:.8rem;color:var(--muted);min-width:4rem;text-align:center}
        .search-input-wrap{margin:1.5rem 0 1rem}
        .search-input{width:100%;font-family:var(--font-body);font-size:1rem;padding:.75rem 1rem;border:1px solid var(--border);border-radius:var(--radius-md);background:#fff;color:var(--text);outline:none;box-sizing:border-box}
        .search-input:focus{border-color:var(--navy);box-shadow:0 0 0 3px rgba(0,0,0,.08)}
        .search-empty{color:var(--muted);font-size:.9rem;margin-top:1.5rem}
        .search-groups{display:flex;flex-direction:column;gap:.65rem;margin-top:.75rem}
        .search-group{border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;background:#fff}
        .search-group-header{width:100%;display:flex;align-items:center;gap:.75rem;padding:.85rem 1rem;background:none;border:none;cursor:pointer;text-align:left;position:relative}
        .search-group-header:hover{background:rgba(0,0,0,.03)}
        .search-group-title-row{display:flex;align-items:baseline;gap:.5rem;flex:1;flex-wrap:wrap}
        .search-group-title{font-family:var(--font-display);font-size:1.05rem;font-weight:300;color:var(--navy)}
        .search-group-code{font-family:var(--font-mono);font-size:.72rem;color:var(--muted);letter-spacing:.04em}
        .search-group-meta{display:flex;align-items:center;gap:.65rem;flex-shrink:0}
        .search-group-dept{font-size:.78rem;color:var(--muted)}
        .search-group-count{font-family:var(--font-body);font-size:.72rem;color:var(--muted);background:var(--cream-dark);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.1rem .5rem;white-space:nowrap}
        .search-group-chevron{font-size:.65rem;color:var(--muted);flex-shrink:0}
        .search-sections{border-top:1px solid var(--border)}
        .search-section{padding:.75rem 1rem;border-top:1px solid var(--border);display:flex;align-items:center;gap:.75rem;cursor:pointer;flex-wrap:wrap}
        .search-section:first-child{border-top:none}
        .search-section:hover{background:rgba(0,0,0,.03)}
        .search-section-active{background:rgba(0,0,0,.04)}
        .search-section-instructor{font-size:.88rem;color:var(--text)}
        .search-section-location{font-family:var(--font-body);font-size:.78rem;color:var(--muted)}
        .cal-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:40;display:flex;align-items:center;justify-content:center;padding:1.25rem}
        .cal-modal{background:#fff;border:1px solid var(--border);border-radius:var(--radius-md);max-width:420px;width:100%;padding:1.5rem 1.75rem;box-shadow:var(--shadow-lg)}
        .cal-modal h3{font-family:var(--font-display);font-size:1.35rem;font-weight:300;color:var(--navy);margin:0 0 .5rem}
        .cal-modal p{font-size:.88rem;line-height:1.55;color:var(--muted);margin:0 0 1.25rem}
        .cal-modal-actions{display:flex;flex-direction:column;gap:.5rem}
        .cal-modal-btn{font-family:var(--font-body);font-size:.75rem;letter-spacing:.05em;text-transform:uppercase;border-radius:var(--radius-sm);padding:.65rem 1rem;cursor:pointer;border:1px solid var(--border);background:var(--cream);color:var(--text)}
        .cal-modal-btn--primary{background:var(--navy);color:var(--gold);border-color:var(--navy)}
        .cal-modal-btn--ghost{background:transparent;color:var(--muted)}
        .cal-modal-btn:disabled{opacity:.45;cursor:not-allowed}
        .redesign-root footer{border-top:1px solid var(--border);padding:1.25rem 2.5rem;display:flex;justify-content:space-between;background:var(--cream)}.footer-left{display:flex;align-items:center;gap:.85rem}.avatar{width:30px;height:30px;background:var(--navy);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-body);font-size:.68rem;color:var(--gold)}.footer-note{font-family:var(--font-body);font-size:.7rem;color:var(--muted)}

        /* Hamburger + drawer — hidden on desktop */
        .hamburger{display:none}
        .mobile-menu{display:none}
        /* Mobile results page — hidden on desktop */
        .mobile-results-nav{display:none}
        .mobile-form-hidden,.mobile-results-hidden{/* no-op on desktop */}

        @media(max-width:640px){
          /* ── Nav ── */
          .redesign-root nav{padding:.7rem 1rem;gap:.5rem;top:0;width:100%;margin:0}
          .header-right{gap:.4rem}
          .semester-toggle{display:none}
          .top-tabs{display:none}
          .logo-wordmark{font-size:.88rem}

          /* ── Hamburger ── */
          .hamburger{display:flex;flex-direction:column;justify-content:center;gap:5px;background:none;border:none;cursor:pointer;padding:.3rem;margin-left:auto}
          .hamburger span{display:block;width:22px;height:2px;background:var(--navy);border-radius:2px;transition:transform 200ms,opacity 200ms}
          .hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
          .hamburger.open span:nth-child(2){opacity:0}
          .hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}

          /* ── Mobile drawer ── */
          .mobile-menu{display:block;position:absolute;top:100%;left:0;right:0;background:var(--cream);border-bottom:1px solid var(--border);z-index:9;overflow:hidden;max-height:0;transition:max-height 260ms ease}
          .mobile-menu.open{max-height:360px}
          .mobile-menu-inner{padding:.75rem 1.25rem 1.25rem;display:flex;flex-direction:column;gap:.25rem}
          .mobile-nav-btn{font-family:var(--font-display);font-size:1.35rem;color:var(--navy);background:none;border:none;text-align:left;padding:.6rem 0;cursor:pointer;letter-spacing:-.01em;border-bottom:1px solid var(--border)}
          .mobile-nav-btn:last-child{border-bottom:none}
          .mobile-nav-btn.active{color:var(--gold-dim)}

          /* ── Main layout ── */
          .redesign-main{padding:1.25rem 1.25rem 8rem !important}
          .eyebrow{display:none}
          .hero-title{font-size:clamp(2rem,9.5vw,2.8rem);letter-spacing:-.02em;margin-bottom:.35rem;line-height:1.08}
          .subheadline{font-size:1rem;margin-bottom:.6rem}
          .description{display:none}
          .divider{margin:1.25rem 0}
          .form-section{margin-bottom:1.75rem}

          /* ── Section labels ── */
          .section-label{gap:.5rem;margin-bottom:.75rem;align-items:flex-start;width:100%}
          .step-number{font-size:.58rem;padding:.18rem .5rem;opacity:.8;flex-shrink:0;margin-top:.3rem}
          .section-title{font-size:1.25rem;letter-spacing:-.01em;flex:1;line-height:1.2}
          .when-section-label .when-free-row .section-title{flex:0 1 auto}
          .when-free-row .day-btn.when-now-btn{width:auto;min-width:0;height:2.1rem;padding:0 .85rem;font-size:.82rem}

          /* ── Form: time & day ── */
          .when-section{display:flex;flex-direction:column;align-items:stretch;gap:.85rem}
          .when-section .section-label{order:1;margin-bottom:0}
          .when-section .time-range-block{order:2;flex-direction:column;align-items:stretch;gap:.65rem}
          .when-section .day-strip{order:3;display:grid;grid-template-columns:repeat(5,1fr);gap:.35rem;width:100%}
          .day-btn{height:2.4rem;padding:0;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-pill);font-size:.9rem;width:100%}
          .time-btn{flex:0 0 auto;border-radius:var(--radius-pill)}
          .time-range-dual{gap:.45rem}
          .dual-range{height:44px}
          .time-range-readout-line{font-size:.78rem;align-self:center;width:fit-content;margin:0 auto}

          /* ── Chips: horizontal scroll rows ── */
          .chips{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:.4rem;padding-bottom:.4rem;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin-left:-1.25rem;margin-right:-1.25rem;padding-left:1.25rem;padding-right:1.25rem}
          .chips::-webkit-scrollbar{display:none}
          .chip{flex:0 0 auto;font-size:.82rem;height:auto;padding:.5rem .95rem;border-radius:var(--radius-pill);white-space:nowrap;line-height:1}
          .building-chips{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:.4rem;padding-bottom:.4rem;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin-left:-1.25rem;margin-right:-1.25rem;padding-left:1.25rem;padding-right:1.25rem;margin-top:.5rem;animation:none}
          .building-chips::-webkit-scrollbar{display:none}

          /* ── CTA: sticky bottom bar ── */
          .cta-wrapper{position:fixed;bottom:0;left:0;right:0;padding:.75rem 1.25rem 1.1rem;background:var(--cream);border-top:1px solid var(--border);z-index:20;margin-top:0}
          .cta-btn{border-radius:var(--radius-pill);padding:.95rem 2rem;font-size:.8rem;letter-spacing:.1em;box-shadow:0 -2px 20px rgba(0,0,0,.08)}

          /* ── Results: stacked cards ── */
          .results-table-wrap{border-radius:var(--radius-md);overflow:hidden}
          .results-table thead{display:none}
          .results-table tbody,.results-table tr,.results-table td{display:block;width:100%}
          .results-table tbody tr{padding:.85rem 1rem;border-top:1px solid var(--border);position:relative}
          .results-table td{padding:0;border:none}
          .results-table td:nth-child(1),.results-table td:nth-child(4),.results-table td:nth-child(7){display:none}
          .results-table td:nth-child(2){display:inline;vertical-align:middle;margin-right:.4rem}
          .results-table td:nth-child(3){display:inline;vertical-align:middle}
          .results-table td:nth-child(5){margin-top:.35rem}
          .results-table td:nth-child(6){margin-top:.1rem}
          .rt-title{font-size:.88rem}
          .rt-time,.rt-location{font-size:.72rem}
          .result-count{font-size:.72rem;margin-bottom:.5rem}

          /* ── Expanded card ── */
          .expanded-card-wrap{padding:.875rem 1rem}
          .card-body{padding:1.1rem 1.25rem}
          .card-top{flex-direction:column;gap:.5rem}
          .card-time-badge{align-self:flex-start}
          .card-title{font-size:1.25rem}
          .card-actions{padding:.85rem 1.25rem;flex-wrap:wrap;gap:.5rem}
          .btn-secondary,.btn-primary{font-size:.7rem;padding:.55rem .9rem}

          /* ── Pagination ── */
          .pagination{display:flex;align-items:center;justify-content:center;margin-top:1.5rem;gap:.6rem}
          .page-btn{padding:.85rem 1.4rem;font-size:.72rem}

          /* ── Footer ── */
          .redesign-root footer{padding:1rem 1.25rem;flex-direction:column;gap:.5rem;align-items:flex-start}

          /* ── Calendar modal ── */
          .cal-modal{padding:1.25rem}

          /* ── Mobile page switching ── */
          .mobile-form-hidden{display:none !important}
          .mobile-results-hidden{display:none !important}
          .mobile-results-nav{display:flex;flex-direction:column;gap:.75rem;padding-bottom:1.25rem;border-bottom:1px solid var(--border);margin-bottom:1.5rem;animation:results-fade-in 250ms ease both}
          .mobile-back-btn{display:inline-flex;align-items:center;gap:.35rem;font-family:var(--font-body);font-size:.82rem;letter-spacing:0;color:var(--muted);background:none;border:none;cursor:pointer;padding:0}
          .mobile-back-btn:hover{color:var(--text)}
          .mobile-filter-chips{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:.35rem;-webkit-overflow-scrolling:touch;scrollbar-width:none}
          .mobile-filter-chips::-webkit-scrollbar{display:none}
          .filter-tag{font-family:var(--font-body);font-size:.7rem;letter-spacing:0;color:var(--text);background:var(--chip-bg);border:1px solid var(--border);border-radius:var(--radius-pill);padding:.25rem .65rem;white-space:nowrap;flex:0 0 auto}
        }
      `}</style>
      <div className="redesign-root">
        <nav>
          <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
            <a className="logo" href="#">
              <div className="logo-mark">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <text x="16" y="21" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="bold" fill="#fff" textAnchor="middle">CF</text>
                </svg>
              </div>
              <span className="logo-wordmark">CalFinder</span>
            </a>
          </div>
          <div className="header-right">
            <div className="top-tabs">
              <button className={`top-tab-btn ${topTab === "discover" ? "active" : ""}`} onClick={() => setTopTab("discover")} type="button">Discover</button>
              <button className={`top-tab-btn ${topTab === "search" ? "active" : ""}`} onClick={() => setTopTab("search")} type="button">Search</button>
              <button className={`top-tab-btn ${topTab === "saved" ? "active" : ""}`} onClick={() => setTopTab("saved")} type="button">Saved{savedIds.size > 0 && <span className="saved-badge">{savedIds.size}</span>}</button>
              <button className={`top-tab-btn ${topTab === "categories" ? "active" : ""}`} onClick={() => setTopTab("categories")} type="button">Categories</button>
              {SHOW_EDITOR && <button className={`top-tab-btn ${topTab === "editor" ? "active" : ""}`} onClick={() => setTopTab("editor")} type="button">Editor</button>}
            </div>
            <div className="semester-toggle">
              <span className="semester-badge">Fall 2026</span>
            </div>
          </div>
          {/* Hamburger — mobile only */}
          <button
            className={`hamburger${menuOpen ? " open" : ""}`}
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOpen(o => !o)}
          >
            <span /><span /><span />
          </button>
          {/* Mobile slide-down drawer */}
          <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
            <div className="mobile-menu-inner">
              <button className={`mobile-nav-btn${topTab === "discover" ? " active" : ""}`} type="button" onClick={() => { setTopTab("discover"); setMenuOpen(false); }}>Discover</button>
              <button className={`mobile-nav-btn${topTab === "search" ? " active" : ""}`} type="button" onClick={() => { setTopTab("search"); setMenuOpen(false); }}>Search</button>
              <button className={`mobile-nav-btn${topTab === "saved" ? " active" : ""}`} type="button" onClick={() => { setTopTab("saved"); setMenuOpen(false); }}>
                Saved{savedIds.size > 0 && <span className="saved-badge" style={{ marginLeft: ".5rem" }}>{savedIds.size}</span>}
              </button>
              <button className={`mobile-nav-btn${topTab === "categories" ? " active" : ""}`} type="button" onClick={() => { setTopTab("categories"); setMenuOpen(false); }}>Categories</button>
              {SHOW_EDITOR && <button className={`mobile-nav-btn${topTab === "editor" ? " active" : ""}`} type="button" onClick={() => { setTopTab("editor"); setMenuOpen(false); }}>Editor</button>}
            </div>
          </div>
        </nav>
        <main className="redesign-main">
          {topTab === "discover" ? (
            <DiscoverTab
              mobileShowResults={mobileShowResults}
              setMobileShowResults={setMobileShowResults}
              freeRangeStartMinutes={freeRangeStartMinutes}
              freeRangeEndMinutes={freeRangeEndMinutes}
              selectedWeekday={selectedWeekday}
              setSelectedWeekday={setSelectedWeekday}
              selectedInterests={selectedInterests}
              toggleInterest={toggleInterest}
              selectedArea={selectedArea}
              setSelectedArea={setSelectedArea}
              selectedBuilding={selectedBuilding}
              setSelectedBuilding={setSelectedBuilding}
              usingNow={usingNow}
              setUsingNow={setUsingNow}
              handleNow={handleNow}
              applyFreeRange={applyFreeRange}
              freeRangeValid={freeRangeValid}
              handleFindClass={handleFindClass}
              hasSearched={hasSearched}
              lastPool={lastPool}
              sortedPool={sortedPool}
              resultsKey={resultsKey}
              sortCol={sortCol}
              sortDir={sortDir}
              handleSort={handleSort}
              page={page}
              setPage={setPage}
              currentCourse={currentCourse}
              setCurrentCourse={setCurrentCourse}
              savedIds={savedIds}
              toggleSave={toggleSave}
              setPendingCalendarCourse={setPendingCalendarCourse}
            />
          ) : topTab === "saved" ? (
            <SavedTab
              savedCourses={savedCourses}
              currentCourse={currentCourse}
              setCurrentCourse={setCurrentCourse}
              toggleSave={toggleSave}
              setPendingCalendarCourse={setPendingCalendarCourse}
            />
          ) : topTab === "search" ? (
            <SearchTab
              semester={semester}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchGroups={searchGroups}
              expandedCodes={expandedCodes}
              toggleExpandCode={toggleExpandCode}
              currentSearchSection={currentSearchSection}
              setCurrentSearchSection={setCurrentSearchSection}
              savedIds={savedIds}
              toggleSave={toggleSave}
              setPendingCalendarCourse={setPendingCalendarCourse}
            />
          ) : topTab === "categories" ? (
            <CategoriesTab />
          ) : SHOW_EDITOR ? (
            <EditorTab
              allCourses={allCourses}
              uniqueCourseCount={uniqueCourseCount}
              filteredCourses={filteredCourses}
              semester={semester}
              semesterCourses={semesterCourses}
              dayMatchedCourses={dayMatchedCourses}
              interestMatchedCourses={interestMatchedCourses}
              undersizedCourses={undersizedCourses}
              onDownloadDatabase={handleDownloadDatabase}
            />
          ) : null}
        </main>
        <footer>
          <a className="logo" href="#">
            <div className="logo-mark">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <text x="16" y="21" fontFamily="Georgia" fontSize="13" fontWeight="bold" fill="#FDB515" textAnchor="middle">CF</text>
              </svg>
            </div>
            <span className="logo-wordmark">CalFinder <span style={{ fontWeight: 400, opacity: 0.5 }}>· UC Berkeley</span></span>
          </a>
        </footer>
        {pendingCalendarCourse && (
          <CalendarModal course={pendingCalendarCourse} onClose={() => setPendingCalendarCourse(null)} />
        )}
      </div>
    </>
  );
}
