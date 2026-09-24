import type { Course } from "../../lib/types";
import { meetDaysToRfcByDay, openGoogleCalendar, tokenizeMeetDays } from "./helpers";

export function CalendarModal({
  course,
  onClose
}: {
  course: Course;
  onClose: () => void;
}) {
  return (
    <div
      className="cal-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cal-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cal-modal">
        <h3 id="cal-modal-title">Add to Google Calendar</h3>
        <p>
          The event date is the <strong>next day this class meets</strong> in Berkeley time (for example,
          MW on a Sunday starts on the upcoming Monday). Title and class times are pre-filled. Sign in
          with Google if asked. Choose a single session or repeat every week on this pattern. You can
          still edit repeat and end date before saving.
        </p>
        <div className="cal-modal-actions">
          <button
            type="button"
            className="cal-modal-btn cal-modal-btn--primary"
            onClick={() => {
              openGoogleCalendar(course, "once");
              onClose();
            }}
          >
            One-time event
          </button>
          <button
            type="button"
            className="cal-modal-btn"
            disabled={meetDaysToRfcByDay(tokenizeMeetDays(course.meetDays)) === null}
            onClick={() => {
              openGoogleCalendar(course, "weekly");
              onClose();
            }}
          >
            Weekly
            {course.meetDays ? ` (${course.meetDays})` : ""}
          </button>
          <button type="button" className="cal-modal-btn cal-modal-btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
