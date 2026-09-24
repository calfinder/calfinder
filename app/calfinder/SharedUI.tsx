"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import type { Course } from "../../lib/types";
import { LOCKED_WINDOW_MINUTES } from "./constants";
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
  snapToHalfHour,
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

type TimeRangeBarProps = {
  startMin: number;
  endMin: number;
  onStartChange: (snapped: number) => void;
  onEndChange: (snapped: number) => void;
  min: number;
  max: number;
  formatLabel: (m: number) => string;
  endLocked: boolean;
};

export function TimeRangeBar({
  startMin,
  endMin,
  onStartChange,
  onEndChange,
  min,
  max,
  formatLabel,
  endLocked
}: TimeRangeBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<"start" | "end" | "range" | null>(null);
  const dragRangeAnchor = useRef<{ clientX: number; startMin: number; endMin: number } | null>(null);

  const toSnappedFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const t = (clientX - rect.left) / Math.max(1, rect.width);
      const raw = min + t * (max - min);
      return snapToHalfHour(Math.max(min, Math.min(max, raw)));
    },
    [min, max]
  );

  const startRef = useRef(startMin);
  const endRef = useRef(endMin);
  startRef.current = startMin;
  endRef.current = endMin;

  const onBarPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".dual-range-thumb")) return;
    if ((e.target as HTMLElement).closest(".dual-range-fill")) {
      dragRangeAnchor.current = { clientX: e.clientX, startMin, endMin };
      setDrag("range");
      return;
    }
    const snapped = toSnappedFromClientX(e.clientX);
    if (snapped === null) return;
    const distS = Math.abs(snapped - startMin);
    const distE = Math.abs(snapped - endMin);
    if (distS <= distE) {
      if (endLocked) {
        onStartChange(Math.max(min, Math.min(snapped, max - LOCKED_WINDOW_MINUTES)));
      } else {
        onStartChange(Math.max(min, Math.min(snapped, endMin - LOCKED_WINDOW_MINUTES)));
      }
    } else {
      onEndChange(Math.min(max, Math.max(snapped, startMin + LOCKED_WINDOW_MINUTES)));
    }
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      if (drag === "range") {
        const anchor = dragRangeAnchor.current;
        if (!anchor) return;
        const el = trackRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const pxPerMin = rect.width / Math.max(1, max - min);
        const deltaPx = e.clientX - anchor.clientX;
        const rangeWindow = anchor.endMin - anchor.startMin;
        const rawStart = anchor.startMin + deltaPx / pxPerMin;
        const newStart = Math.max(min, Math.min(snapToHalfHour(rawStart), max - rangeWindow));
        const newEnd = newStart + rangeWindow;
        onStartChange(newStart);
        onEndChange(newEnd);
        return;
      }
      const s = toSnappedFromClientX(e.clientX);
      if (s === null) return;
      if (drag === "start") {
        if (endLocked) {
          onStartChange(Math.max(min, Math.min(s, max - LOCKED_WINDOW_MINUTES)));
        } else {
          onStartChange(Math.max(min, Math.min(s, endRef.current - LOCKED_WINDOW_MINUTES)));
        }
      } else {
        onEndChange(Math.min(max, Math.max(s, startRef.current + LOCKED_WINDOW_MINUTES)));
      }
    };
    const onUp = () => { dragRangeAnchor.current = null; setDrag(null); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, [drag, endLocked, min, max, onStartChange, onEndChange, toSnappedFromClientX]);

  const pct0 = minutesToBarPercent(startMin, min, max);
  const pct1 = minutesToBarPercent(endMin, min, max);
  const w = Math.max(0, pct1 - pct0);

  return (
    <div className="time-range-dual">
      <div
        className="dual-range"
        ref={trackRef}
        onPointerDown={onBarPointerDown}
        style={{ touchAction: "none" }}
        role="group"
        aria-label="Free time window"
      >
        <div className="dual-range-bg" />
        <div
          className="dual-range-fill"
          style={{ left: `${pct0}%`, width: `${w}%` }}
        />
        <button
          type="button"
          className="dual-range-thumb dual-range-thumb--start"
          style={{ left: `${pct0}%` }}
          aria-label="Window starts at"
          aria-valuemin={min}
          aria-valuemax={endLocked ? max - LOCKED_WINDOW_MINUTES : endMin - LOCKED_WINDOW_MINUTES}
          aria-valuenow={startMin}
          role="slider"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onStartChange(Math.max(min, startMin - 30));
            }
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onStartChange(
                endLocked
                  ? Math.min(startMin + 30, max - LOCKED_WINDOW_MINUTES)
                  : Math.min(startMin + 30, endMin - LOCKED_WINDOW_MINUTES)
              );
            }
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLButtonElement).focus();
            setDrag("start");
          }}
        />
        <button
          type="button"
          className={`dual-range-thumb dual-range-thumb--end${endLocked ? " dual-range-thumb--end-locked" : ""}`}
          style={{ left: `${pct1}%` }}
          aria-label="Window ends at"
          title={
            endLocked
              ? "Drag past 1 hour to plan a longer window"
              : "Window end"
          }
          aria-valuemin={startMin + LOCKED_WINDOW_MINUTES}
          aria-valuemax={max}
          aria-valuenow={endMin}
          role="slider"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onEndChange(Math.max(endMin - 30, startMin + LOCKED_WINDOW_MINUTES));
            }
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onEndChange(Math.min(max, endMin + 30));
            }
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLButtonElement).focus();
            setDrag("end");
          }}
        />
      </div>
      <p className="time-range-readout-line" aria-hidden>
        <span className="time-range-time">{formatLabel(startMin)}</span>
        <span className="time-range-sep">-</span>
        <span className="time-range-time">{formatLabel(endMin)}</span>
      </p>
    </div>
  );
}
