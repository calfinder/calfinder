"use client";

import React from "react";

import type { Course, Interest } from "../../lib/types";
import { CourseDetailCard, TimeRangeBar } from "./SharedUI";
import { CAMPUS_AREAS, EARLIEST_MINUTES, INTEREST_OPTIONS, LATEST_MINUTES, WEEKDAY_BUTTONS } from "./constants";
import {
  formatBuildingLabel,
  formatInstructor,
  formatMeetDays,
  formatMinutes12h,
  formatTimeRange,
  shouldUseNow
} from "./helpers";
import type { WeekdayToken } from "./types";

const PAGE_SIZE = 10;

export function DiscoverTab({
  mobileShowResults,
  setMobileShowResults,
  freeRangeStartMinutes,
  freeRangeEndMinutes,
  selectedWeekday,
  setSelectedWeekday,
  selectedInterests,
  toggleInterest,
  selectedArea,
  setSelectedArea,
  selectedBuilding,
  setSelectedBuilding,
  usingNow,
  setUsingNow,
  handleNow,
  applyFreeRange,
  freeRangeValid,
  handleFindClass,
  hasSearched,
  lastPool,
  sortedPool,
  resultsKey,
  sortCol,
  sortDir,
  handleSort,
  page,
  setPage,
  currentCourse,
  setCurrentCourse,
  savedIds,
  toggleSave,
  setPendingCalendarCourse
}: {
  mobileShowResults: boolean;
  setMobileShowResults: (v: boolean) => void;
  freeRangeStartMinutes: number;
  freeRangeEndMinutes: number;
  selectedWeekday: WeekdayToken;
  setSelectedWeekday: (t: WeekdayToken) => void;
  selectedInterests: Interest[];
  toggleInterest: (i: Interest) => void;
  selectedArea: string | null;
  setSelectedArea: (v: string | null) => void;
  selectedBuilding: string | null;
  setSelectedBuilding: (v: string | null) => void;
  usingNow: boolean;
  setUsingNow: (v: boolean) => void;
  handleNow: () => void;
  applyFreeRange: (nextStart: number, nextEnd: number) => void;
  freeRangeValid: boolean;
  handleFindClass: () => void;
  hasSearched: boolean;
  lastPool: Course[];
  sortedPool: Course[];
  resultsKey: number;
  sortCol: "code" | "enrollment" | null;
  sortDir: "asc" | "desc";
  handleSort: (col: "code" | "enrollment") => void;
  page: number;
  setPage: (updater: (p: number) => number) => void;
  currentCourse: Course | null;
  setCurrentCourse: (c: Course | null) => void;
  savedIds: Set<string>;
  toggleSave: (id: string, e: React.MouseEvent) => void;
  setPendingCalendarCourse: (c: Course | null) => void;
}) {
  return (
    <React.Fragment>
      {/* ── Mobile results header ── */}
      {mobileShowResults && (
        <div className="mobile-results-nav">
          <button className="mobile-back-btn" type="button" onClick={() => { setMobileShowResults(false); window.scrollTo(0, 0); }}>
            ← Back
          </button>
          <div className="mobile-filter-chips">
            <span className="filter-tag">{formatMinutes12h(freeRangeStartMinutes)}–{formatMinutes12h(freeRangeEndMinutes)}</span>
            <span className="filter-tag">{WEEKDAY_BUTTONS.find(b => b.token === selectedWeekday)?.label}</span>
            {selectedInterests.map(i => <span key={i} className="filter-tag">{i}</span>)}
            {selectedArea && <span className="filter-tag">{selectedArea}</span>}
          </div>
        </div>
      )}

      {/* ── Form (hidden on mobile when viewing results) ── */}
      <div className={mobileShowResults ? "mobile-form-hidden" : ""}>
        <h1 className="hero-title">Got a Free Window?</h1>
        <p className="subheadline">Wander into a class.</p>
        <p className="description">Pick a time range you&apos;re free and what sparks your curiosity. We&apos;ll list Berkeley classes that meet during that window on the day you choose.</p>
        <div className="divider" />
        <div className="form-section when-section">
          <div className="section-label when-section-label">
            <div className="when-free-row">
              <span className="section-title">When are you free?</span>
              <button className={`day-btn when-now-btn ${usingNow ? "active" : ""}`} type="button" onClick={handleNow}>Now</button>
            </div>
          </div>
          <div className="time-range-block">
            <div className="time-range-main">
              <TimeRangeBar
                startMin={freeRangeStartMinutes}
                endMin={freeRangeEndMinutes}
                onChange={applyFreeRange}
                min={EARLIEST_MINUTES}
                max={LATEST_MINUTES}
                formatLabel={formatMinutes12h}
              />
            </div>
          </div>
          <div className="day-strip">
            {WEEKDAY_BUTTONS.map(({ token, label }) => (
              <button
                key={token}
                type="button"
                className={`day-btn ${selectedWeekday === token ? "active" : ""}`}
                onClick={() => {
                  setSelectedWeekday(token);
                  setUsingNow(shouldUseNow(token, freeRangeStartMinutes));
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-section">
          <div className="section-label"><span className="section-title">What are you into? <span className="label-opt">(optional)</span></span></div>
          <div className="chips">
            {INTEREST_OPTIONS.map((interest) => (
              <button key={interest} type="button" className={`chip ${selectedInterests.includes(interest) ? "active" : ""}`} onClick={() => toggleInterest(interest)}>{interest}</button>
            ))}
          </div>
        </div>
        <div className="form-section">
          <div className="section-label"><span className="section-title">Where are you? <span className="label-opt">(optional)</span></span></div>
          <div className="chips">
            {["Southside", "Northside", "Eastside", "Westside"].map((area) => (
              <button
                key={area}
                type="button"
                className={`chip ${selectedArea === area ? "active" : ""}`}
                onClick={() => {
                  if (selectedArea === area) {
                    setSelectedArea(null);
                    setSelectedBuilding(null);
                  } else {
                    setSelectedArea(area);
                    setSelectedBuilding(null);
                  }
                }}
              >{area}</button>
            ))}
          </div>
          {selectedArea && (
            <div className="building-chips">
              {[...CAMPUS_AREAS[selectedArea]]
                .filter((b) => b !== "Chou Hall N540 and")
                .sort((a, b) => formatBuildingLabel(a).localeCompare(formatBuildingLabel(b)))
                .map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`chip chip--sm ${selectedBuilding === b ? "active" : ""}`}
                    onClick={() => setSelectedBuilding(selectedBuilding === b ? null : b)}
                  >{formatBuildingLabel(b)}</button>
                ))}
            </div>
          )}
        </div>
        <div className="cta-wrapper">
          <button className="cta-btn" type="button" onClick={handleFindClass} disabled={!freeRangeValid}><span>Find classes</span></button>
        </div>
      </div>

      <div className={!mobileShowResults ? "mobile-results-hidden" : ""}>
        {hasSearched && lastPool.length === 0 && (
          <div className="prominent-message prominent-message--form">
            No classes match that combination.
            <br />
            Try a different day, time, or interest.
          </div>
        )}
        {lastPool.length > 0 && (
          <div className="result-section" key={resultsKey}>
            <p className="result-count">{sortedPool.length} {sortedPool.length === 1 ? "class" : "classes"} available · Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedPool.length)} · Click a row to expand</p>
            <div className="results-table-wrap">
              <table className="results-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort("enrollment")}>
                      Class Size <span className="sort-arrow">{sortCol === "enrollment" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
                    </th>
                    <th className="sortable" onClick={() => handleSort("code")}>
                      Code <span className="sort-arrow">{sortCol === "code" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
                    </th>
                    <th>Title</th>
                    <th>Topic</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Instructor</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPool.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((course) => {
                    const isOpen = currentCourse?.id === course.id;
                    return (
                      <React.Fragment key={course.id}>
                        <tr
                          className={isOpen ? "row-active" : ""}
                          onClick={() => setCurrentCourse(isOpen ? null : course)}
                        >
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
                            <td colSpan={7}>
                              <CourseDetailCard
                                course={course}
                                isSaved={savedIds.has(course.id)}
                                onToggleSave={toggleSave}
                                onOpenCalendar={(e) => { e.stopPropagation(); setPendingCalendarCourse(course); }}
                                onCollapse={(e) => { e.stopPropagation(); setCurrentCourse(null); }}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sortedPool.length > PAGE_SIZE && (
              <div className="pagination">
                <button
                  className="page-btn"
                  type="button"
                  disabled={page === 0}
                  onClick={() => { setPage(p => p - 1); setCurrentCourse(null); }}
                >← Prev</button>
                <span className="page-info">{page + 1} / {Math.ceil(sortedPool.length / PAGE_SIZE)}</span>
                <button
                  className="page-btn"
                  type="button"
                  disabled={(page + 1) * PAGE_SIZE >= sortedPool.length}
                  onClick={() => { setPage(p => p + 1); setCurrentCourse(null); }}
                >Next →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </React.Fragment>
  );
}
