"use client";

import React from "react";

import type { Course, Semester } from "../../lib/types";
import { CourseDetailCard } from "./SharedUI";
import { formatBuildingLabel, formatMeetDays, formatTimeRange } from "./helpers";

export function SearchTab({
  semester,
  searchQuery,
  setSearchQuery,
  searchGroups,
  expandedCodes,
  toggleExpandCode,
  currentSearchSection,
  setCurrentSearchSection,
  savedIds,
  toggleSave,
  setPendingCalendarCourse
}: {
  semester: Semester;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchGroups: { code: string; sections: Course[] }[];
  expandedCodes: Set<string>;
  toggleExpandCode: (code: string, sections: Course[]) => void;
  currentSearchSection: string | null;
  setCurrentSearchSection: (id: string | null) => void;
  savedIds: Set<string>;
  toggleSave: (id: string, e: React.MouseEvent) => void;
  setPendingCalendarCourse: (c: Course | null) => void;
}) {
  return (
    <>
      <h1 className="hero-title">Find a Class</h1>
      <p className="subheadline">Search by name, instructor, or topic.</p>
      <div className="search-input-wrap">
        <input
          className="search-input"
          type="search"
          placeholder="e.g. astronomy, history of art, Dacher Keltner…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
      </div>
      {searchQuery.trim() && searchGroups.length === 0 && (
        <p className="search-empty">No classes found for &ldquo;{searchQuery}&rdquo; in {semester}.</p>
      )}
      {searchGroups.length > 0 && (
        <div className="search-groups">
          <p className="result-count">{searchGroups.length} {searchGroups.length === 1 ? "course" : "courses"} found</p>
          {searchGroups.map(({ code, sections }) => {
            const isOpen = expandedCodes.has(code);
            const rep = sections[0];
            return (
              <div key={code} className="search-group">
                <button
                  type="button"
                  className="search-group-header"
                  onClick={() => toggleExpandCode(code, sections)}
                  aria-expanded={isOpen}
                >
                  <div className="search-group-title-row">
                    <span className="search-group-title">{rep.title}</span>
                    <span className="search-group-code">{rep.code}</span>
                  </div>
                  <div className="search-group-meta">
                    <span className="search-group-dept">{rep.department}</span>
                    <span className="search-group-count">{sections.length} {sections.length === 1 ? "section" : "sections"}</span>
                  </div>
                  <span className="search-group-chevron">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="search-sections">
                    {sections.length === 1 ? (
                      <CourseDetailCard
                        course={sections[0]}
                        isSaved={savedIds.has(sections[0].id)}
                        onToggleSave={toggleSave}
                        onOpenCalendar={(e) => { e.stopPropagation(); setPendingCalendarCourse(sections[0]); }}
                        onCollapse={(e) => { e.stopPropagation(); toggleExpandCode(code, sections); }}
                      />
                    ) : sections.map((sec) => {
                      const secOpen = currentSearchSection === sec.id;
                      return (
                        <React.Fragment key={sec.id}>
                          <div
                            className={`search-section${secOpen ? " search-section-active" : ""}`}
                            onClick={() => setCurrentSearchSection(secOpen ? null : sec.id)}
                          >
                            <span className="card-time-badge">{formatMeetDays(sec.meetDays)} · {formatTimeRange(sec.startTime, sec.endTime)}</span>
                            <span className="search-section-instructor">{sec.instructor}</span>
                            <span className="search-section-location">{formatBuildingLabel(sec.building)}{sec.room && sec.room !== "TBD" ? `, ${sec.room}` : ""}</span>
                          </div>
                          {secOpen && (
                            <CourseDetailCard
                              course={sec}
                              isSaved={savedIds.has(sec.id)}
                              onToggleSave={toggleSave}
                              onOpenCalendar={(e) => { e.stopPropagation(); setPendingCalendarCourse(sec); }}
                              onCollapse={(e) => { e.stopPropagation(); setCurrentSearchSection(null); }}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
