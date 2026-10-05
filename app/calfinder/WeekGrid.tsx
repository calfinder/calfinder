"use client";

import React from "react";

import { WEEKDAY_BUTTONS } from "./constants";
import { meetDaysIncludes } from "./helpers";
import type { WeekdayToken } from "./types";

/** One class time on the grid. It shows on every day in meetDays. */
export type WeekItem = {
  key: string;
  code: string;
  /** "10:00 AM - 10:59 AM" */
  time: string;
  /** Third line when the block is tall enough: a title or a room */
  detail: string;
  meetDays: string;
  startMinutes: number;
  endMinutes: number;
  /** Grayed out and not clickable */
  muted?: boolean;
  selected?: boolean;
  /** Extra words for the hover and screen-reader label */
  note?: string;
};

/** An item placed in its day column; overlapping items split the column into lanes. */
type PlacedItem = { item: WeekItem; lane: number; lanes: number };

export const WEEKDAY_NAMES: Record<WeekdayToken, string> = { M: "Monday", T: "Tuesday", W: "Wednesday", Tr: "Thursday", F: "Friday" };
const WEEKDAY_SHORT: Record<WeekdayToken, string> = { M: "Mon", T: "Tue", W: "Wed", Tr: "Thu", F: "Fri" };
// The grid always covers at least 8 AM–6 PM, and grows to fit earlier or later classes.
const GRID_START_HOUR = 8;
const GRID_END_HOUR = 18;
// Shorter blocks only have room for the code and time.
const MIN_MINUTES_FOR_DETAIL = 70;

/** Today's weekday and minutes since midnight from the device clock. Null day on weekends. */
export function getNow(): { day: WeekdayToken | null; minutes: number } {
  const now = new Date();
  return { day: WEEKDAY_BUTTONS[now.getDay() - 1]?.token ?? null, minutes: now.getHours() * 60 + now.getMinutes() };
}

/** Splits overlapping items into side-by-side lanes, like a calendar app. */
function layoutDay(items: WeekItem[]): PlacedItem[] {
  const sorted = [...items].sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);
  const placed: PlacedItem[] = [];
  let group: PlacedItem[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    for (const p of group) p.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (item.startMinutes >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((end) => end <= item.startMinutes);
    if (lane === -1) lane = laneEnds.push(item.endMinutes) - 1;
    else laneEnds[lane] = item.endMinutes;
    const p = { item, lane, lanes: 1 };
    group.push(p);
    placed.push(p);
    groupEnd = Math.max(groupEnd, item.endMinutes);
  }
  closeGroup();
  return placed;
}

/** "8 AM", "12 PM" */
function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? "AM" : "PM"}`;
}

/** Positions in the grid scale with --week-ppm (pixels per minute), which is smaller on phones. */
const minutesToPx = (minutes: number) => `calc(${minutes} * var(--week-ppm) * 1px)`;

/** Mon–Fri columns with each class placed by time. Today's column and the current time are marked. */
export function WeekGrid({
  items,
  onSelect,
  label
}: {
  items: WeekItem[];
  onSelect: (item: WeekItem) => void;
  label: string;
}) {
  const now = getNow();
  const startMinutes = Math.min(GRID_START_HOUR * 60, Math.floor(Math.min(...items.map((s) => s.startMinutes)) / 60) * 60);
  const endMinutes = Math.max(GRID_END_HOUR * 60, Math.ceil(Math.max(...items.map((s) => s.endMinutes)) / 60) * 60);
  const hours: number[] = [];
  for (let m = startMinutes; m <= endMinutes; m += 60) hours.push(m / 60);
  const showNowLine = now.day !== null && now.minutes >= startMinutes && now.minutes <= endMinutes;

  return (
    <div className="week-grid" role="group" aria-label={label}>
      <div className="week-grid-head" aria-hidden="true">
        <span />
        {WEEKDAY_BUTTONS.map(({ token }) => (
          <span key={token} className={`week-grid-dayname${token === now.day ? " is-today" : ""}`}>
            {WEEKDAY_SHORT[token]}
          </span>
        ))}
      </div>
      <div className="week-grid-body" style={{ height: minutesToPx(endMinutes - startMinutes) }}>
        <div className="week-grid-times" aria-hidden="true">
          {hours.map((h) => (
            <span key={h} style={{ top: minutesToPx(h * 60 - startMinutes) }}>{hourLabel(h)}</span>
          ))}
        </div>
        {WEEKDAY_BUTTONS.map(({ token }) => {
          const isToday = token === now.day;
          return (
            <div key={token} className={`week-grid-day${isToday ? " is-today" : ""}`} role="group" aria-label={WEEKDAY_NAMES[token]}>
              {layoutDay(items.filter((s) => meetDaysIncludes(s.meetDays, token))).map(({ item, lane, lanes }) => {
                const style: React.CSSProperties = {
                  top: minutesToPx(item.startMinutes - startMinutes),
                  height: `calc(${item.endMinutes - item.startMinutes} * var(--week-ppm) * 1px - 2px)`,
                  left: `calc(${lane} * 100% / ${lanes} + 2px)`,
                  width: `calc(100% / ${lanes} - 4px)`
                };
                const fullLabel = `${WEEKDAY_NAMES[token]} ${item.time}: ${item.code}, ${item.detail}${item.note ? ` (${item.note})` : ""}`;
                const content = (
                  <>
                    <span className="week-block-code">{item.code}</span>
                    <span className="week-block-time">{item.time}</span>
                    {item.endMinutes - item.startMinutes >= MIN_MINUTES_FOR_DETAIL && (
                      <span className="week-block-detail">{item.detail}</span>
                    )}
                  </>
                );
                if (item.muted) {
                  return (
                    <div key={item.key} className="week-block is-limited" style={style} title={fullLabel}>
                      {content}
                    </div>
                  );
                }
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`week-block${item.selected ? " is-open" : ""}`}
                    style={style}
                    title={fullLabel}
                    aria-label={fullLabel}
                    aria-pressed={!!item.selected}
                    onClick={() => onSelect(item)}
                  >
                    {content}
                  </button>
                );
              })}
              {isToday && showNowLine && <div className="week-grid-now" style={{ top: minutesToPx(now.minutes - startMinutes) }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
