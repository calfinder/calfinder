"use client";

import React, { useMemo, useRef } from "react";

import type { Course } from "../../lib/types";
import { normalizeRoom, type RoomRef, type RoomSlot } from "../../lib/rooms";
import {
  buildMapsUrl,
  formatMinutes12h,
  formatTimeRange,
  meetDaysIncludes,
  roomLabel,
  roomSearchText,
  roomSlug,
  siteLink,
  timeStringToMinutes,
  tokenizeMeetDays
} from "./helpers";
import { CourseDetailCard, ShareButton } from "./SharedUI";
import type { PreparedCourse } from "./types";
import { getNow, WeekGrid, type WeekItem } from "./WeekGrid";

/**
 * A slot plus the Discover course it matches, if any. Only those open into a card; the rest
 * (small, graduate, lab classes...) just show the room is in use.
 */
type SlotView = RoomSlot & { startMinutes: number; endMinutes: number; course: PreparedCourse | null };
type RoomEntry = RoomRef & { label: string; searchText: string; slots: SlotView[]; meetingsPerWeek: number; seats: number | null };
const MAX_MATCHES = 40;
const BUSIEST_COUNT = 8;

const slotCode = (s: SlotView) => s.course?.code ?? s.code;
const seatsLabel = (seats: number) => `${seats.toLocaleString("en-US")} seats`;
const CLASSROOM_DATABASE_URL = "https://classrooms.berkeley.edu/classroom-database";

/** What's scheduled in the room right now. Null on weekends. */
function nowStatus(slots: SlotView[]): string | null {
  const { day: today, minutes } = getNow();
  if (!today) return null;
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
  openId,
  setOpenId,
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
  /** The class whose card is open below the week grid */
  openId: string | null;
  setOpenId: (id: string | null) => void;
  savedIds: Set<string>;
  toggleSave: (id: string, e: React.MouseEvent) => void;
  setPendingCalendarCourse: (c: Course | null) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const rooms = useMemo(() => {
    const listedById = new Map(listedCourses.map((c) => [c.id, c]));
    const map = new Map<string, RoomEntry>();
    for (const slot of roomSlots ?? []) {
      const ref = normalizeRoom(slot.building, slot.room);
      let entry = map.get(ref.key);
      if (!entry) {
        entry = { ...ref, label: roomLabel(ref), searchText: roomSearchText(ref), slots: [], meetingsPerWeek: 0, seats: null };
        map.set(ref.key, entry);
      }
      entry.seats ??= slot.seats ?? null;
      entry.meetingsPerWeek += tokenizeMeetDays(slot.meetDays).length;
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
    () => [...rooms.values()].sort((a, b) => b.meetingsPerWeek - a.meetingsPerWeek).slice(0, BUSIEST_COUNT),
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
  // A card link can name any cross-listed copy; the grid shows the copy Discover lists.
  const openCourse = useMemo(() => {
    if (!openId || !selected) return null;
    return selected.slots.find((s) => s.course && s.ids.includes(openId))?.course ?? null;
  }, [openId, selected]);

  function pickRoom(key: string | null) {
    setSelectedKey(key);
    setOpenId(null);
    window.scrollTo(0, 0);
  }

  function toggleSlot(slot: SlotView) {
    if (!slot.course) return;
    if (openCourse?.id === slot.course.id) {
      setOpenId(null);
      return;
    }
    setOpenId(slot.course.id);
    requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const intro = (
    <>
      <h1 className="hero-title">Room Schedule</h1>
      <p className="subheadline">See every lecture that meets in a classroom, all week.</p>
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
    const hasLimited = selected?.slots.some((s) => !s.course) ?? false;
    const hasListed = selected?.slots.some((s) => s.course) ?? false;
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
                {selected.seats !== null && `${seatsLabel(selected.seats)} · `}
                {selected.meetingsPerWeek} {selected.meetingsPerWeek === 1 ? "lecture" : "lectures"} a week ·{" "}
                <a href={buildMapsUrl(selected.building)} target="_blank" rel="noreferrer">Map</a> ·{" "}
                <ShareButton
                  className="room-link-btn"
                  title={selected.label}
                  getUrl={() => siteLink({ room: roomSlug(selected) })}
                />
              </p>
              {status && <p className="room-status">{status}</p>}
            </div>
            <p className="room-legend">
              {hasListed && <span>Tap a class for details.</span>}
              {hasLimited && <span><i className="room-swatch" />In use, not listed for sitting in</span>}
            </p>
            <WeekGrid
              label="Weekly lecture schedule"
              items={selected.slots.map((slot): WeekItem => ({
                key: slot.ids[0],
                code: slotCode(slot),
                time: formatTimeRange(slot.startTime, slot.endTime),
                detail: slot.course?.title ?? slot.title,
                meetDays: slot.meetDays,
                startMinutes: slot.startMinutes,
                endMinutes: slot.endMinutes,
                muted: !slot.course,
                selected: !!slot.course && slot.course.id === openCourse?.id,
                note: slot.course ? undefined : "not listed for sitting in"
              }))}
              onSelect={(item) => {
                const slot = selected.slots.find((s) => s.ids[0] === item.key);
                if (slot) toggleSlot(slot);
              }}
            />
            {openCourse && (
              <div className="room-card" ref={cardRef}>
                <CourseDetailCard
                  course={openCourse}
                  isSaved={savedIds.has(openCourse.id)}
                  onToggleSave={toggleSave}
                  onOpenCalendar={(e) => { e.stopPropagation(); setPendingCalendarCourse(openCourse); }}
                  onCollapse={(e) => { e.stopPropagation(); setOpenId(null); }}
                />
              </div>
            )}
            <div className="room-notes">
              {hasLimited && <p>Gray classes aren&apos;t listed for sitting in, but they show when the room is in use.</p>}
              <p>Only lectures are listed, so sections, labs, exams and events may still use the room.</p>
              {selected.seats !== null && (
                <p>
                  Seat count from UC Berkeley&apos;s{" "}
                  <a href={CLASSROOM_DATABASE_URL} target="_blank" rel="noreferrer">classroom database</a>.
                </p>
              )}
            </div>
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
              <button key={r.key} type="button" className="chip chip--sm" onClick={() => pickRoom(r.key)}>
                {r.label}
                {r.seats !== null && <span className="chip-seats"> · {seatsLabel(r.seats)}</span>}
              </button>
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
                  <span className="search-group-count">
                    {r.seats !== null && `${seatsLabel(r.seats)} · `}
                    {r.meetingsPerWeek} {r.meetingsPerWeek === 1 ? "lecture" : "lectures"} a week
                  </span>
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
