"use client";

import React from "react";

import type { Course } from "../../lib/types";
import { CourseDetailCard } from "./SharedUI";
import { formatBuildingLabel, formatInstructor, formatMeetDays, formatTimeRange } from "./helpers";

export function SavedTab({
  savedCourses,
  currentCourse,
  setCurrentCourse,
  toggleSave,
  setPendingCalendarCourse
}: {
  savedCourses: Course[];
  currentCourse: Course | null;
  setCurrentCourse: (c: Course | null) => void;
  toggleSave: (id: string, e: React.MouseEvent) => void;
  setPendingCalendarCourse: (c: Course | null) => void;
}) {
  return (
    <>
      <h1 className="hero-title">Saved Classes</h1>
      <p className="subheadline">Your personal shortlist.</p>
      {savedCourses.length === 0 ? (
        <p className="saved-empty">No saved classes yet. Bookmark a row from your search results.</p>
      ) : (
        <div className="result-section">
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
                          <td colSpan={7}>
                            <CourseDetailCard
                              course={course}
                              isSaved
                              removeMode
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
        </div>
      )}
    </>
  );
}
