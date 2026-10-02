"use client";

import React, { useMemo, useState } from "react";

import type { Course } from "../../lib/types";
import { normalizeRoom, type RoomRef, type RoomSlot } from "../../lib/rooms";
import { WEEKDAY_BUTTONS } from "./constants";
import {
  buildMapsUrl,
  formatMinutes12h,
  formatTimeRange,
  meetDaysIncludes,
  roomLabel,
  roomSearchText,
  timeStringToMinutes
} from "./helpers";
import { CourseDetailCard } from "./SharedUI";
import type { PreparedCourse, WeekdayToken } from "./types";

/**
 * A slot plus the Discover course it matches, if any. Only those open into a card; the rest
 * (small, graduate, lab classes...) just show the room is in use.
 */
type SlotView = RoomSlot & { startMinutes: number; endMinutes: number; course: PreparedCourse | null };
type RoomEntry = RoomRef & { label: string; searchText: string; slots: SlotView[] };

const MAX_MATCHES = 40;
const BUSIEST_COUNT = 8;
const WEEKDAY_NAMES: Record<WeekdayToken, string> = { M: "Monday", T: "Tuesday", W: "Wednesday", Tr: "Thursday", F: "Friday" };

const slotCode = (s: SlotView) => s.course?.code ?? s.code;

/** What's scheduled in the room right now, from the device clock. Null on weekends. */
function nowStatus(slots: SlotView[]): string | null {
  const now = new Date();
  const today = WEEKDAY_BUTTONS[now.getDay() - 1]?.token;
  if (!today) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const todays = slots.filter((s) => meetDaysIncludes(s.meetDays, today));
  const current = todays.find((s) => s.startMinutes <= minutes && minutes < s.endMinutes);
  if (current) return `In use now: ${slotCode(current)} until ${formatMinutes12h(current.endMinutes)}`;
  const next = todays.filter((s) => s.startMinutes > minutes).sort((a, b) => a.startMinutes - b.startMinutes)[0];
  if (next) return `No lecture listed right now · next is ${slotCode(next)} at ${formatMinutes12h(next.startMinutes)}`;
  return "No more lectures listed here today";
}

export function RoomsTab({
  roomSlots,
  listedCourses,
  loadFailed,
  onRetry,
  query,
  setQuery,
  selectedKey,
  setSelectedKey,
  day,
  setDay,
  savedIds,
  toggleSave,
  setPendingCalendarCourse
}: {
  roomSlots: RoomSlot[] | null;
  /** The classes Discover shows; only these get a card here */
  listedCourses: PreparedCourse[];
  loadFailed: boolean;
  onRetry: () => void;
  query: string;
  setQuery: (v: string) => void;
  selectedKey: string | null;
  setSelectedKey: (key: string | null) => void;
  day: WeekdayToken;
  setDay: (d: WeekdayToken) => void;
  savedIds: Set<string>;
  toggleSave: (id: string, e: React.MouseEvent) => void;
  setPendingCalendarCourse: (c: Course | null) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const rooms = useMemo(() => {
    const listedById = new Map(listedCourses.map((c) => [c.id, c]));
    const map = new Map<string, RoomEntry>();
    for (const slot of roomSlots ?? []) {
      const ref = normalizeRoom(slot.building, slot.room);
      let entry = map.get(ref.key);
      if (!entry) {
        entry = { ...ref, label: roomLabel(ref), searchText: roomSearchText(ref), slots: [] };
        map.set(ref.key, entry);
      }
      entry.slots.push({
        ...slot,
        startMinutes: timeStringToMinutes(slot.startTime),
        endMinutes: timeStringToMinutes(slot.endTime),
        course: slot.ids.map((id) => listedById.get(id)).find((c) => c !== undefined) ?? null
      });
    }
    return map;
  }, [roomSlots, listedCourses]);

  const busiest = useMemo(
    () => [...rooms.values()].sort((a, b) => b.slots.length - a.slots.length).slice(0, BUSIEST_COUNT),
    [rooms]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // Also try "vlsb2040" as "vlsb 2040"
    const variants = [q, q.replace(/([a-z])(\d)/g, "$1 $2")].map((v) => v.split(/\s+/).filter(Boolean));
    const isExact = (r: RoomEntry) => variants[0].includes(r.room.toLowerCase());
    return [...rooms.values()]
      .filter((r) => variants.some((tokens) => tokens.every((t) => r.searchText.includes(t))))
      .sort((a, b) => Number(isExact(b)) - Number(isExact(a)) || a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [query, rooms]);

  const selected = selectedKey ? rooms.get(selectedKey) ?? null : null;
  const daySlots = useMemo(
    () =>
      (selected?.slots ?? [])
        .filter((s) => meetDaysIncludes(s.meetDays, day))
        .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes),
    [selected, day]
  );

  function pickRoom(key: string | null) {
    setSelectedKey(key);
    setOpenId(null);
    window.scrollTo(0, 0);
  }

  const intro = (
    <>
      <h1 className="hero-title">Room Schedule</h1>
      <p className="subheadline">See every lecture that meets in a classroom.</p>
    </>
  );

  if (roomSlots === null) {
    return (
      <>
        {intro}
        {loadFailed ? (
          <p className="search-empty">
            Couldn&apos;t load room schedules.{" "}
            <button type="button" className="room-link-btn" onClick={onRetry}>Try again</button>
          </p>
        ) : (
          <p className="search-empty">Loading room schedules…</p>
        )}
      </>
    );
  }

  if (selectedKey) {
    const status = selected ? nowStatus(selected.slots) : null;
    return (
      <>
        {intro}
        <button type="button" className="room-back-btn" onClick={() => pickRoom(null)}>← All rooms</button>
        {!selected ? (
          <p className="search-empty">No lectures are listed for this room.</p>
        ) : (
          <div className="room-view">
            <div className="room-header">
              <h2 className="room-title">{selected.label}</h2>
              <p className="room-meta">
                {selected.slots.length} {selected.slots.length === 1 ? "class meets" : "classes meet"} here each week ·{" "}
                <a href={buildMapsUrl(selected.building)} target="_blank" rel="noreferrer">Map</a>
              </p>
              {status && <p className="room-status">{status}</p>}
            </div>
            <div className="day-strip room-day-strip">
              {WEEKDAY_BUTTONS.map(({ token, label }) => (
                <button
                  key={token}
                  type="button"
                  className={`day-btn ${day === token ? "active" : ""}`}
                  onClick={() => { setDay(token); setOpenId(null); }}
                >
                  {label}
                </button>
              ))}
            </div>
            {daySlots.length === 0 ? (
              <p className="search-empty">No lectures listed in this room on {WEEKDAY_NAMES[day]}.</p>
            ) : (
              <div className="result-section room-results" key={`${selected.key}-${day}`}>
                <p className="result-count">
                  {daySlots.length} {daySlots.length === 1 ? "lecture" : "lectures"} on {WEEKDAY_NAMES[day]} · Click a row to expand
                </p>
                <div className="results-table-wrap">
                  <table className="results-table room-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Code</th>
                        <th>Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daySlots.map((slot) => {
                        const course = slot.course;
                        const time = <td><span className="rt-time">{formatTimeRange(slot.startTime, slot.endTime)}</span></td>;
                        if (!course) {
                          return (
                            <tr key={slot.ids[0]} className="room-row-limited">
                              {time}
                              <td><span className="rt-code">{slot.code}</span></td>
                              <td><span className="rt-title">{slot.title}</span></td>
                            </tr>
                          );
                        }
                        const isOpen = openId === course.id;
                        return (
                          <React.Fragment key={slot.ids[0]}>
                            <tr className={isOpen ? "row-active" : ""} onClick={() => setOpenId(isOpen ? null : course.id)}>
                              {time}
                              <td><span className="rt-code">{course.code}</span></td>
                              <td><span className="rt-title">{course.title}</span></td>
                            </tr>
                            {isOpen && (
                              <tr className="expanded-row">
                                <td colSpan={3}>
                                  <CourseDetailCard
                                    course={course}
                                    isSaved={savedIds.has(course.id)}
                                    onToggleSave={toggleSave}
                                    onOpenCalendar={(e) => { e.stopPropagation(); setPendingCalendarCourse(course); }}
                                    onCollapse={(e) => { e.stopPropagation(); setOpenId(null); }}
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
                {daySlots.some((s) => !s.course) && (
                  <p className="room-note">
                    Grayed-out classes aren&apos;t listed for sitting in (small, graduate and lab classes, for example).
                    They&apos;re shown so you know the room is in use.
                  </p>
                )}
              </div>
            )}
            <p className="room-note">
              Lectures only. Discussion sections, labs, exams and events aren&apos;t listed, so the room may be in use when nothing
              shows here. Times and rooms can change, so check{" "}
              <a href="https://classes.berkeley.edu" target="_blank" rel="noreferrer">classes.berkeley.edu</a> before you go.
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {intro}
      <div className="search-input-wrap">
        <input
          className="search-input"
          type="search"
          placeholder="e.g. Wheeler 150, Dwinelle 155, VLSB 2040…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      {!query.trim() ? (
        <div className="room-busiest">
          <p className="result-count">Busiest rooms</p>
          <div className="chips">
            {busiest.map((r) => (
              <button key={r.key} type="button" className="chip chip--sm" onClick={() => pickRoom(r.key)}>{r.label}</button>
            ))}
          </div>
        </div>
      ) : matches.length === 0 ? (
        <p className="search-empty">No lectures meet in a room matching &ldquo;{query}&rdquo; this semester.</p>
      ) : (
        <div className="search-groups">
          <p className="result-count">
            {matches.length} {matches.length === 1 ? "room" : "rooms"} found
            {matches.length > MAX_MATCHES ? ` · Showing the first ${MAX_MATCHES}, keep typing to narrow it down` : ""}
          </p>
          {matches.slice(0, MAX_MATCHES).map((r) => (
            <div key={r.key} className="search-group">
              <button type="button" className="search-group-header" onClick={() => pickRoom(r.key)}>
                <div className="search-group-title-row">
                  <span className="search-group-title">{r.label}</span>
                </div>
                <div className="search-group-meta">
                  <span className="search-group-count">{r.slots.length} {r.slots.length === 1 ? "class" : "classes"}</span>
                </div>
                <span className="search-group-chevron">→</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
