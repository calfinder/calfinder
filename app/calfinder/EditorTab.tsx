import type { Course, Semester } from "../../lib/types";
import { MIN_CLASS_CAPACITY } from "./constants";
import { formatBuildingLabel, formatInstructor, formatMeetDays, formatTimeRange } from "./helpers";

export function EditorTab({
  allCourses,
  uniqueCourseCount,
  filteredCourses,
  semester,
  semesterCourses,
  dayMatchedCourses,
  interestMatchedCourses,
  undersizedCourses,
  onDownloadDatabase
}: {
  allCourses: Course[];
  uniqueCourseCount: number;
  filteredCourses: Course[];
  semester: Semester;
  semesterCourses: Course[];
  dayMatchedCourses: Course[];
  interestMatchedCourses: Course[];
  undersizedCourses: Course[];
  onDownloadDatabase: () => void;
}) {
  return (
    <>
      <h1 className="hero-title">Editor tools</h1>
      <p className="description">Quick testing stats about the currently loaded database.</p>
      <div className="editor-panel">
        <p className="editor-title">Dataset stats</p>
        <div className="editor-grid">
          <div className="editor-stat">
            <p className="editor-stat-label">Classes in database</p>
            <p className="editor-stat-value">{allCourses.length.toLocaleString()}</p>
          </div>
          <div className="editor-stat">
            <p className="editor-stat-label">Unique course codes</p>
            <p className="editor-stat-value">{uniqueCourseCount.toLocaleString()}</p>
          </div>
          <div className="editor-stat">
            <p className="editor-stat-label">Current filtered matches</p>
            <p className="editor-stat-value">{filteredCourses.length.toLocaleString()}</p>
          </div>
          <div className="editor-stat">
            <p className="editor-stat-label">Current semester</p>
            <p className="editor-stat-value">{semester}</p>
          </div>
          <div className="editor-stat">
            <p className="editor-stat-label">Semester matches</p>
            <p className="editor-stat-value">{semesterCourses.length.toLocaleString()}</p>
          </div>
          <div className="editor-stat">
            <p className="editor-stat-label">Semester + day matches</p>
            <p className="editor-stat-value">{dayMatchedCourses.length.toLocaleString()}</p>
          </div>
          <div className="editor-stat">
            <p className="editor-stat-label">After interest filter</p>
            <p className="editor-stat-value">{interestMatchedCourses.length.toLocaleString()}</p>
          </div>
          <div className="editor-stat">
            <p className="editor-stat-label">Excluded: under {MIN_CLASS_CAPACITY} capacity</p>
            <p className="editor-stat-value">{undersizedCourses.length.toLocaleString()}</p>
          </div>
        </div>
        <div className="editor-actions">
          <button className="editor-button" type="button" onClick={onDownloadDatabase}>
            Download loaded database JSON
          </button>
        </div>
        <p className="editor-note">
          Filtered matches include time-in-session logic, so this can be very small even when the
          total database is large.
        </p>
      </div>
      {undersizedCourses.length > 0 && (
        <div className="editor-panel">
          <p className="editor-title">Excluded for capacity under {MIN_CLASS_CAPACITY}</p>
          <div className="results-table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Class Size</th>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Instructor</th>
                </tr>
              </thead>
              <tbody>
                {undersizedCourses.map((course) => (
                  <tr key={course.id}>
                    <td><span className="rt-classsize">{course.enrolledCount}/{course.enrolledMax}</span></td>
                    <td><span className="rt-code">{course.code}</span></td>
                    <td><span className="rt-title">{course.title}</span></td>
                    <td><span className="rt-time">{formatMeetDays(course.meetDays)} · {formatTimeRange(course.startTime, course.endTime)}</span></td>
                    <td><span className="rt-location">{formatBuildingLabel(course.building)}{course.room && course.room !== "TBD" ? `, ${course.room}` : ""}</span></td>
                    <td><span className="rt-instructor">{formatInstructor(course.instructor)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
