"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import type { Course } from "../../lib/types";
import {
  buildMapsUrl,
  formatBuildingLabel,
  formatInstructor,
  formatMeetDays,
  formatTimeRange,
  getDisplayCollege,
  getDisplayDepartment,
  minutesToBarPercent,
  rateMyProfessorSearchUrl,
  stripPrereqText
} from "./helpers";

export function InstructorWithRmpLink({ instructor }: { instructor: string }) {
  const formatted = formatInstructor(instructor);
  if (formatted === "Staff") return <>{formatted}</>;
  const m = formatted.match(/^(Prof\.|Professor)\s+(.+)$/i);
  if (m) {
    const url = rateMyProfessorSearchUrl(m[2]);
    return (
      <>
        {m[1]}{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="card-instructor-link">
          {m[2]}
        </a>
      </>
    );
  }
  const url = rateMyProfessorSearchUrl(formatted);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="card-instructor-link">
      {formatted}
    </a>
  );
}

/** The expanded course detail card shown when a row/section is clicked open. */
export function CourseDetailCard({
  course,
  isSaved,
  removeMode = false,
  onToggleSave,
  onOpenCalendar,
  onCollapse
}: {
  course: Course;
  isSaved: boolean;
  removeMode?: boolean;
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onOpenCalendar: (e: React.MouseEvent) => void;
  onCollapse: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="expanded-card-wrap">
      <div className="course-card">
        <div className="card-body">
          <div className="card-top">
            <div>
              <p className="card-college">{getDisplayDepartment(course.department, course.code.split(" ")[0])}</p>
              <span className="card-dept">{getDisplayCollege(course)}</span>
            </div>
            <span className="card-time-badge">{formatMeetDays(course.meetDays)} · {formatTimeRange(course.startTime, course.endTime)}</span>
          </div>
          <h2 className="card-title">{course.title}</h2>
          <p className="card-meta">{course.code} · <InstructorWithRmpLink instructor={course.instructor} /></p>
          <div className="card-divider" />
          <div className="card-location"><a href={buildMapsUrl(course.building)} target="_blank" rel="noreferrer">{formatBuildingLabel(course.building)}, Room {course.room}</a></div>
          <p className="card-desc">{stripPrereqText(course.description)}</p>
          <div className="card-tags">{course.interests.map((tag) => <span key={tag} className="card-tag">{tag}</span>)}</div>
        </div>
        <div className="card-actions">
          <button className="btn-secondary" type="button" onClick={(e) => onToggleSave(course.id, e)}>
            <span style={{ fontSize: "1.1rem", lineHeight: 1, marginRight: ".3rem" }}>{removeMode || isSaved ? "★" : "☆"}</span>
            {removeMode ? "Remove" : isSaved ? "Saved" : "Save"}
          </button>
          <button className="btn-secondary" type="button" onClick={onOpenCalendar}>Add to Calendar</button>
          <button className="btn-primary" type="button" onClick={onCollapse}>Collapse ↑</button>
        </div>
      </div>
    </div>
  );
}

const TRB_SNAP = 30; // handles rest only on times ending in :00 or :30
const TRB_MIN_GAP = 30; // minimum window size in minutes
const snapToStep = (v: number) => Math.round(v / TRB_SNAP) * TRB_SNAP;

type DragMode = "start" | "end" | "range";

type TimeRangeBarProps = {
  startMin: number;
  endMin: number;
  onChange: (nextStart: number, nextEnd: number) => void;
  min: number;
  max: number;
  formatLabel: (m: number) => string;
};

export function TimeRangeBar({
  startMin,
  endMin,
  onChange,
  min,
  max,
  formatLabel
}: TimeRangeBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragMode | null>(null);
  const [live, setLive] = useState<{ start: number; end: number } | null>(null);
  const liveRef = useRef<{ start: number; end: number } | null>(null);
  const dragRef = useRef<{ mode: DragMode; anchorX: number; startAt: number; endAt: number } | null>(null);

  const setLiveBoth = useCallback((s: number, e: number) => {
    const next = { start: Math.round(s), end: Math.round(e) };
    liveRef.current = next;
    setLive(next);
  }, []);

  // While dragging we snap to 30-minute steps so the handles only ever rest on
  // times ending in :00 or :30.
  const start = live ? live.start : startMin;
  const end = live ? live.end : endMin;

  const valueFromX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      return min + t * (max - min);
    },
    [min, max]
  );

  const moveTo = useCallback(
    (clientX: number) => {
      const d = dragRef.current;
      const el = trackRef.current;
      if (!d || !el) return;
      if (d.mode === "range") {
        const rect = el.getBoundingClientRect();
        const perMin = rect.width / Math.max(1, max - min);
        const win = d.endAt - d.startAt;
        let s = d.startAt + (clientX - d.anchorX) / perMin;
        s = Math.max(min, Math.min(s, max - win));
        setLiveBoth(s, s + win);
        return;
      }
      const v = valueFromX(clientX);
      if (v === null) return;
      if (d.mode === "start") {
        setLiveBoth(Math.max(min, Math.min(v, d.endAt - TRB_MIN_GAP)), d.endAt);
      } else {
        setLiveBoth(d.startAt, Math.min(max, Math.max(v, d.startAt + TRB_MIN_GAP)));
      }
    },
    [valueFromX, min, max, setLiveBoth]
  );

  const beginDrag = useCallback(
    (mode: DragMode, clientX: number) => {
      dragRef.current = { mode, anchorX: clientX, startAt: startMin, endAt: endMin };
      setLiveBoth(startMin, endMin);
      setDrag(mode);
    },
    [startMin, endMin, setLiveBoth]
  );

  const onTrackPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".dual-range-thumb")) return;
    if (target.closest(".dual-range-fill")) {
      beginDrag("range", e.clientX);
      return;
    }
    // Press anywhere on the track: move the nearest handle there and keep dragging it.
    const v = valueFromX(e.clientX);
    if (v === null) return;
    const mode: DragMode = Math.abs(v - startMin) <= Math.abs(v - endMin) ? "start" : "end";
    dragRef.current = { mode, anchorX: e.clientX, startAt: startMin, endAt: endMin };
    setDrag(mode);
    if (mode === "start") {
      setLiveBoth(Math.max(min, Math.min(v, endMin - TRB_MIN_GAP)), endMin);
    } else {
      setLiveBoth(startMin, Math.min(max, Math.max(v, startMin + TRB_MIN_GAP)));
    }
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      moveTo(e.clientX);
    };
    const onUp = () => {
      const cur = liveRef.current;
      if (cur) {
        let s = snapToStep(cur.start);
        let e = snapToStep(cur.end);
        s = Math.max(min, Math.min(s, max - TRB_MIN_GAP));
        e = Math.min(max, Math.max(e, s + TRB_MIN_GAP));
        onChange(s, e);
      }
      dragRef.current = null;
      liveRef.current = null;
      setLive(null);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, [drag, moveTo, onChange, min, max]);

  // Handles jump between 30-minute increments: position everything from the
  // snapped values so the thumbs and fill land only on :00 or :30 marks.
  const dispStart = snapToStep(start);
  const dispEnd = snapToStep(end);
  const pct0 = minutesToBarPercent(dispStart, min, max);
  const pct1 = minutesToBarPercent(dispEnd, min, max);
  const w = Math.max(0, pct1 - pct0);
    // Keep the 16px thumbs fully inside the track: their centers travel within an
    // 8px inset on each end, and the fill shares the same mapping so it stays aligned.
    const insetPos = (pct: number) => `calc((100% - 16px) * ${pct / 100} + 8px)`;

  return (
    <div className="time-range-dual">
      <div
        className="dual-range"
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        style={{ touchAction: "none" }}
        role="group"
        aria-label="Free time window"
      >
        <div className="dual-range-bg" />
        <div className="dual-range-fill" style={{ left: insetPos(pct0), width: `calc((100% - 16px) * ${w / 100})` }} />
        <button
          type="button"
          className={`dual-range-thumb dual-range-thumb--start${drag === "start" ? " is-dragging" : ""}`}
          style={{ left: insetPos(pct0) }}
          role="slider"
          aria-label="Window start"
          aria-valuemin={min}
          aria-valuemax={endMin - TRB_MIN_GAP}
          aria-valuenow={startMin}
          aria-valuetext={formatLabel(startMin)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(Math.max(min, startMin - TRB_SNAP), endMin);
            }
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(Math.min(startMin + TRB_SNAP, endMin - TRB_MIN_GAP), endMin);
            }
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLButtonElement).focus();
            beginDrag("start", e.clientX);
          }}
        >
          {drag === "start" && <span className="dual-range-bubble">{formatLabel(dispStart)}</span>}
        </button>
        <button
          type="button"
          className={`dual-range-thumb dual-range-thumb--end${drag === "end" ? " is-dragging" : ""}`}
          style={{ left: insetPos(pct1) }}
          role="slider"
          aria-label="Window end"
          aria-valuemin={startMin + TRB_MIN_GAP}
          aria-valuemax={max}
          aria-valuenow={endMin}
          aria-valuetext={formatLabel(endMin)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(startMin, Math.max(endMin - TRB_SNAP, startMin + TRB_MIN_GAP));
            }
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(startMin, Math.min(max, endMin + TRB_SNAP));
            }
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLButtonElement).focus();
            beginDrag("end", e.clientX);
          }}
        >
          {drag === "end" && <span className="dual-range-bubble">{formatLabel(dispEnd)}</span>}
        </button>
      </div>
      <p
        className="time-range-readout-line"
        aria-hidden
        style={{ left: `${Math.min(88, Math.max(12, (pct0 + pct1) / 2))}%` }}
      >
        <span className="time-range-time">{formatLabel(dispStart)}</span>
        <span className="time-range-sep">–</span>
        <span className="time-range-time">{formatLabel(dispEnd)}</span>
      </p>
    </div>
  );
}
