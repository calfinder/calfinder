import { CalFinderClient } from "./CalFinderClient";
import { ErrorBoundary } from "./ErrorBoundary";
import { loadJoinedCourses } from "../lib/loadCourses";

export default async function HomePage() {
  const courses = await loadJoinedCourses();
  return (
    <ErrorBoundary>
      <CalFinderClient initialCourses={courses} />
    </ErrorBoundary>
  );
}
