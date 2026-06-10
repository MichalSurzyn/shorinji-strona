import ScheduleEditor from "@/components/admin/ScheduleEditor";
import { SCHEDULE } from "@/data/schedule";
import { getSchedule } from "@/lib/schedule";

export default async function AdminSchedulePage() {
  const slots = await getSchedule();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Harmonogram zajęć</h1>
        <p className="text-slate-500 mt-1 max-w-2xl">
          Godziny treningów obu grup. Zmiany są od razu widoczne w zakładkach
          Zajęcia oraz w pliku kalendarza (.ics).
        </p>
      </div>
      <ScheduleEditor initialSlots={slots} baseSlots={SCHEDULE} />
    </div>
  );
}
