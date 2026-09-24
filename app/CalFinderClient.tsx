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
