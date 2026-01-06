"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable
} from "@dnd-kit/core";
import { Job } from "@/lib/google-sheets";
import { Badge } from "@/components/ui/badge";

type ViewMode = "month" | "week" | "day";

type PendingMove = {
  job: Job;
  targetDate: string;
};

const START_HOUR = 7;
const END_HOUR = 19;
const HOUR_HEIGHT = 64;

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseJobDate(job: Job) {
  if (!job.date) {
    return new Date();
  }

  const raw = String(job.date);
  if (raw.includes("T")) {
    const datePart = raw.split("T")[0];
    if (raw.endsWith("Z") && raw.includes("00:00")) {
      return new Date(`${datePart}T09:00:00`);
    }
    return new Date(raw);
  }
  if (raw.includes(" ")) {
    return new Date(raw.replace(" ", "T"));
  }

  return new Date(`${raw}T09:00:00`);
}

function formatDisplayDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  return start;
}

function getDaysInMonth(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return {
    year,
    month,
    daysInMonth: lastDay.getDate(),
    startingDayOfWeek: firstDay.getDay()
  };
}

function JobChip({ job, onSelect }: { job: Job; onSelect: (job: Job) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: job.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(job)}
      className={`w-full text-left text-xs rounded px-2 py-1 transition-colors ${
        isDragging
          ? "bg-purple-500/80 text-white"
          : "bg-purple-500/20 text-purple-100 hover:bg-purple-500/40"
      }`}
    >
      <div className="font-medium truncate">{job.title}</div>
      <div className="truncate opacity-80">{job.client}</div>
    </button>
  );
}

function DayDropZone({
  dateKey,
  children
}: {
  dateKey: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-zinc-800/40 p-2 min-h-[120px] transition-colors ${
        isOver ? "bg-purple-500/10 border-purple-500/60" : "bg-zinc-900/40"
      }`}
    >
      {children}
    </div>
  );
}

function DayColumn({
  dateKey,
  children
}: {
  dateKey: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-xl border border-zinc-800/40 bg-zinc-900/40 ${
        isOver ? "ring-1 ring-purple-400/60" : ""
      }`}
      style={{ height: HOUR_HEIGHT * (END_HOUR - START_HOUR + 1) }}
    >
      {children}
    </div>
  );
}

export default function CalendarPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    async function fetchData() {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      setJobs(data.jobs);
      setIsLiveData(data.isLiveData);
    }

    fetchData();
  }, []);

  const jobsByDate = useMemo(() => {
    const map = new Map<string, Job[]>();
    jobs.forEach((job) => {
      const dateKey = toDateKey(parseJobDate(job));
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(job);
    });
    return map;
  }, [jobs]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    if (!over) {
      return;
    }

    const job = jobs.find((item) => item.id === active.id);
    if (!job) {
      return;
    }

    const targetDate = String(over.id);
    const currentDateKey = toDateKey(parseJobDate(job));
    if (currentDateKey === targetDate) {
      return;
    }

    setPendingMove({ job, targetDate });
    setRescheduleReason("");
    setSaveError("");
  };

  const handleRescheduleConfirm = async () => {
    if (!pendingMove) {
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const response = await fetch(
        `/api/jobs/${pendingMove.job.id}/reschedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: pendingMove.targetDate,
            reason: rescheduleReason
          })
        }
      );

      if (!response.ok) {
        throw new Error("Failed to reschedule job");
      }

      setJobs((prev) =>
        prev.map((job) =>
          job.id === pendingMove.job.id
            ? { ...job, date: pendingMove.targetDate }
            : job
        )
      );
      setPendingMove(null);
      setSelectedJob(null);
    } catch (error) {
      setSaveError("Unable to reschedule. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(
    currentDate
  );
  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  const weekStart = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayHours = Array.from(
    { length: END_HOUR - START_HOUR + 1 },
    (_, i) => START_HOUR + i
  );

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Calendar
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Drag jobs to reschedule and keep crews aligned.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isLiveData && (
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                MOCK DATA
              </Badge>
            )}
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white p-1 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              {["month", "week", "day"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as ViewMode)}
                  className={`px-3 py-1 rounded-full uppercase tracking-wider transition-colors ${
                    viewMode === mode
                      ? "bg-purple-500 text-white"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {viewMode === "month" && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Previous
                </button>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {monthName}
                </h2>
                <button
                  onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400 py-2"
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="min-h-[120px]" />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const date = idx + 1;
                    const dateKey = toDateKey(new Date(year, month, date));
                    const dayJobs = jobsByDate.get(dateKey) || [];
                    const isToday =
                      new Date().getDate() === date &&
                      new Date().getMonth() === month &&
                      new Date().getFullYear() === year;

                    return (
                      <DayDropZone key={dateKey} dateKey={dateKey}>
                        <div
                          className={`text-xs font-semibold mb-2 ${
                            isToday
                              ? "text-purple-400"
                              : "text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          {date}
                        </div>
                        <div className="space-y-1">
                          {dayJobs.map((job) => (
                            <JobChip
                              key={job.id}
                              job={job}
                              onSelect={setSelectedJob}
                            />
                          ))}
                        </div>
                      </DayDropZone>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {viewMode !== "month" && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  onClick={() =>
                    setCurrentDate(addDays(currentDate, viewMode === "day" ? -1 : -7))
                  }
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Previous
                </button>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {viewMode === "day"
                    ? formatDisplayDate(toDateKey(currentDate))
                    : `${formatDisplayDate(toDateKey(weekDays[0]))} - ${formatDisplayDate(
                        toDateKey(weekDays[6])
                      )}`}
                </h2>
                <button
                  onClick={() =>
                    setCurrentDate(addDays(currentDate, viewMode === "day" ? 1 : 7))
                  }
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>

              <div className="grid grid-cols-[80px_1fr]">
                <div className="border-r border-zinc-200 dark:border-zinc-800">
                  {dayHours.map((hour) => (
                    <div
                      key={hour}
                      className="h-16 border-b border-zinc-200/60 dark:border-zinc-800/60 text-xs text-zinc-500 flex items-start justify-center pt-2"
                    >
                      {hour}:00
                    </div>
                  ))}
                </div>

                <div
                  className={`grid ${
                    viewMode === "day" ? "grid-cols-1" : "grid-cols-7"
                  } gap-4 p-4`}
                >
                  {(viewMode === "day" ? [currentDate] : weekDays).map(
                    (day) => {
                      const dateKey = toDateKey(day);
                      const dayJobs = jobsByDate.get(dateKey) || [];

                      return (
                        <div key={dateKey} className="space-y-2">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            {day.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric"
                            })}
                          </div>
                          <DayColumn dateKey={dateKey}>
                            {dayHours.map((hour) => (
                              <div
                                key={`${dateKey}-${hour}`}
                                className="border-b border-zinc-800/40"
                                style={{ height: HOUR_HEIGHT }}
                              />
                            ))}
                            {dayJobs.map((job) => {
                              const start = parseJobDate(job);
                              const duration = job.hours ? Number(job.hours) : 3;
                              const minutesFromStart =
                                (start.getHours() - START_HOUR) * 60 +
                                start.getMinutes();
                              const top = (minutesFromStart / 60) * HOUR_HEIGHT;
                              const height = Math.max(duration * HOUR_HEIGHT, 48);

                              return (
                                <div
                                  key={job.id}
                                  className="absolute left-3 right-3"
                                  style={{ top, height }}
                                >
                                  <JobChip job={job} onSelect={setSelectedJob} />
                                </div>
                              );
                            })}
                          </DayColumn>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          )}
        </DndContext>

        {selectedJob && (
          <div className="mt-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Job Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Title</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-50">
                  {selectedJob.title}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Client</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-50">
                  {selectedJob.client}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Status</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-50">
                  {selectedJob.status.charAt(0).toUpperCase() +
                    selectedJob.status.slice(1)}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Price</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-50">
                  ${selectedJob.price}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Phone</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-50">
                  {selectedJob.phoneNumber
                    ? selectedJob.phoneNumber.replace(
                        /(\d{3})(\d{3})(\d{4})/,
                        "($1) $2-$3"
                      )
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Team</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-50">
                  {selectedJob.cleaningTeam.length
                    ? selectedJob.cleaningTeam.join(", ")
                    : "Unassigned"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Reschedule Job
              </h2>
              <button
                onClick={() => setPendingMove(null)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-200">
                  {pendingMove.job.client}
                </span>
                {" - "}
                {pendingMove.job.title}
              </div>
              <div>
                From {formatDisplayDate(toDateKey(parseJobDate(pendingMove.job)))}
                {" to "}
                {formatDisplayDate(pendingMove.targetDate)}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Reschedule Reason
              </label>
              <textarea
                value={rescheduleReason}
                onChange={(event) => setRescheduleReason(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-900 focus:border-purple-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="Add the reason for moving this job..."
                rows={4}
              />
              {saveError && (
                <p className="mt-2 text-sm text-red-400">{saveError}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setPendingMove(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleConfirm}
                disabled={saving}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-70"
              >
                {saving ? "Saving..." : "Confirm Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
