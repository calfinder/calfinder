"use client";

import React, { useMemo, useRef, useState } from "react";

import type { Course } from "../../lib/types";
import { CourseDetailCard } from "./SharedUI";
import { SEMESTER_DATES } from "./constants";
import {
  buildSemesterIcs,
  downloadTextFile,
  formatBuildingLabel,
  formatInstructor,
  formatMeetDays,
  formatTimeRange,
  getCourseSemester,
  hasMeetingTime,
  timeStringToMinutes,
  tokenizeMeetDays
} from "./helpers";
import type { WeekdayToken } from "./types";
import { WEEKDAY_NAMES, WeekGrid, type WeekItem } from "./WeekGrid";

type SavedView = "week" | "list";
const VIEW_KEY = "calfinder-saved-view";

const shortDay = (name: string) => name.slice(0, 3);
const roomText = (c: Course) => `${formatBuildingLabel(c.building)}${c.room && c.room !== "TBD" ? ` ${c.room}` : ""}`;

/** "Dec 4" */
function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "A, B and C" */
const joinAnd = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/**
 * Groups of saved classes that meet at the same time on a shared day,
 * e.g. "MATH 54 and DATA C8 (Mon, Wed)". Classes that clash with each other in a chain form one group.
 */
function findOverlaps(courses: Course[]): string[] {
  const timed = courses.filter(hasMeetingTime);
  const group = timed.map((_, i) => i);
  const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i])));
  const days = new Map<number, Set<WeekdayToken>>();
  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      const a = timed[i];
      const b = timed[j];
      const sameTime =
        timeStringToMinutes(a.startTime) < timeStringToMinutes(b.endTime) &&
        timeStringToMinutes(b.startTime) < timeStringToMinutes(a.endTime);
      const bDays = tokenizeMeetDays(b.meetDays);
      const shared = tokenizeMeetDays(a.meetDays).filter((t) => bDays.includes(t));
      if (!sameTime || shared.length === 0) continue;
      const [ra, rb] = [root(i), root(j)];
      group[rb] = ra;
      const merged = new Set([...(days.get(ra) ?? []), ...(days.get(rb) ?? []), ...shared]);
      days.set(ra, merged);
    }
  }
  const members = new Map<number, Course[]>();
  timed.forEach((c, i) => {
    const r = root(i);
    if (!members.has(r)) members.set(r, []);
    members.get(r)!.push(c);
  });
  const order: WeekdayToken[] = ["M", "T", "W", "Tr", "F"];
  return [...members.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([r, list]) => {
      const shared = order.filter((t) => days.get(r)?.has(t)).map((t) => shortDay(WEEKDAY_NAMES[t]));
      return `${joinAnd(list.map((c) => c.code))} (${shared.join(", ")})`;
    });
}

export function SavedTab({
  savedCourses,
  currentCourse,
  setCurrentCourse,
  toggleSave,
  setPendingCalendarCourse,
  openRoom
}: {
  savedCourses: Course[];
  currentCourse: Course | null;
  setCurrentCourse: (c: Course | null) => void;
  toggleSave: (id: string, e: React.MouseEvent) => void;
  setPendingCalendarCourse: (c: Course | null) => void;
  openRoom: (c: Course) => void;
}) {
  const [view, setViewState] = useState<SavedView>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "week";
    } catch {
      return "week";
    }
  });
  const [calendarNote, setCalendarNote] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  function setView(next: SavedView) {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Storage unavailable (private browsing): the choice just isn't remembered
    }
  }

  const timedCourses = useMemo(() => savedCourses.filter(hasMeetingTime), [savedCourses]);
  const untimedCourses = useMemo(() => savedCourses.filter((c) => !hasMeetingTime(c)), [savedCourses]);
  const overlaps = useMemo(() => findOverlaps(savedCourses), [savedCourses]);
  const classesEnd = savedCourses[0] ? SEMESTER_DATES[getCourseSemester(savedCourses[0])]?.classesEnd : undefined;

  function addAllToCalendar() {
    const { ics, count } = buildSemesterIcs(savedCourses);
    if (count === 0) {
      setCalendarNote("None of your saved classes meet again this semester.");
      return;
    }
    downloadTextFile("calfinder-saved-classes.ics", ics, "text/calendar;charset=utf-8");
    setCalendarNote(
      `Downloaded ${count} ${count === 1 ? "class" : "classes"}. Open the file to add them to Apple Calendar or Outlook. ` +
        "For Google Calendar, go to Settings → Import & export on a computer."
    );
  }

  function selectFromGrid(item: WeekItem) {
    const course = savedCourses.find((c) => c.id === item.key);
    if (!course) return;
    if (currentCourse?.id === course.id) {
      setCurrentCourse(null);
      return;
    }
    setCurrentCourse(course);
    requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const card = (course: Course) => (
    <CourseDetailCard
      course={course}
      isSaved
      removeMode
      onToggleSave={toggleSave}
      onOpenCalendar={(e) => { e.stopPropagation(); setPendingCalendarCourse(course); }}
      onCollapse={(e) => { e.stopPropagation(); setCurrentCourse(null); }}
      onOpenRoom={(e) => { e.stopPropagation(); openRoom(course); }}
    />
  );
  const openInGrid = currentCourse ? savedCourses.find((c) => c.id === currentCourse.id) ?? null : null;

  return (
    <>
      <h1 className="hero-title">Saved Classes</h1>
      <p className="subheadline">Your personal shortlist.</p>
      {savedCourses.length === 0 ? (
        <p className="saved-empty">No saved classes yet. Bookmark a row from your search results.</p>
      ) : (
        <div className="result-section">
          <div className="saved-toolbar">
            <div className="view-toggle" role="group" aria-label="Show saved classes as">
              <button type="button" className={view === "week" ? "active" : ""} aria-pressed={view === "week"} onClick={() => setView("week")}>Week</button>
              <button type="button" className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
            </div>
            <button type="button" className="btn-secondary saved-calendar-btn" onClick={addAllToCalendar}>
              Add all to calendar
            </button>
          </div>
          <p className="saved-calendar-hint" aria-live="polite">
            {calendarNote ??
              `“Add all” downloads one calendar file: every saved class, weekly${classesEnd ? ` until classes end ${formatShortDate(classesEnd)}` : ""}, skipping holidays.`}
          </p>

          {view === "week" ? (
            <>
              <p className="result-count">
                {savedCourses.length} saved {savedCourses.length === 1 ? "class" : "classes"} · Tap a class for details
              </p>
              {overlaps.length > 0 && (
                <p className="saved-overlap">Heads up, these meet at the same time: {overlaps.join("; ")}.</p>
              )}
              <WeekGrid
                label="Your saved classes this week"
                items={timedCourses.map((c): WeekItem => ({
                  key: c.id,
                  code: c.code,
                  time: formatTimeRange(c.startTime, c.endTime),
                  detail: roomText(c),
                  meetDays: c.meetDays,
                  startMinutes: timeStringToMinutes(c.startTime),
                  endMinutes: timeStringToMinutes(c.endTime),
                  selected: c.id === openInGrid?.id
                }))}
                onSelect={selectFromGrid}
              />
              {openInGrid && <div className="room-card" ref={cardRef}>{card(openInGrid)}</div>}
              {untimedCourses.length > 0 && (
                <p className="room-note">
                  Not on the grid because they have no set meeting time: {untimedCourses.map((c) => c.code).join(", ")}.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="result-count">{savedCourses.length} saved {savedCourses.length === 1 ? "class" : "classes"} · Click a row to expand</p>
              <div className="results-table-wrap">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Class Size</th>
                      <th>Code</th>
                      <th>Title</th>
                      <th>Topic</th>
                      <th>Time</th>
                      <th>Location</th>
                      <th>Instructor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedCourses.map((course) => {
                      const isOpen = currentCourse?.id === course.id;
                      return (
                        <React.Fragment key={course.id}>
                          <tr className={isOpen ? "row-active" : ""} onClick={() => setCurrentCourse(isOpen ? null : course)}>
                            <td>{course.enrolledMax !== null && course.enrolledMax !== 0 && course.enrolledCount !== null ? (
                              <span className="rt-classsize">{course.enrolledCount}/{course.enrolledMax}</span>
                            ) : <span style={{ color: "var(--muted)", fontSize: ".75rem" }}>-</span>}</td>
                            <td><span className="rt-code">{course.code}</span></td>
                            <td><span className="rt-title">{course.title}</span></td>
                            <td>
                              <div className="rt-tags">
                                {course.interests.map((tag) => <span key={tag} className="rt-tag">{tag}</span>)}
                              </div>
                            </td>
                            <td><span className="rt-time">{formatMeetDays(course.meetDays)} · {formatTimeRange(course.startTime, course.endTime)}</span></td>
                            <td><span className="rt-location">{formatBuildingLabel(course.building)}{course.room && course.room !== "TBD" ? `, ${course.room}` : ""}</span></td>
                            <td><span className="rt-instructor">{formatInstructor(course.instructor)}</span></td>
                          </tr>
                          {isOpen && (
                            <tr className="expanded-row">
                              <td colSpan={7}>{card(course)}</td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
