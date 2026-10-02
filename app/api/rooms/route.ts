import { loadRoomSchedule } from "../../../lib/loadCourses";

// Built once per deploy. The Rooms tab fetches this only when opened, so the home page stays light.
export const dynamic = "force-static";

export async function GET() {
  return Response.json(await loadRoomSchedule());
}
