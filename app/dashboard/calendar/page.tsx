
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode
} from "react";
import { Job } from "@/lib/google-sheets";
import { Badge } from "@/components/ui/badge";
import {
  calculateCascade,
  calculateDurationForTeamChange,
  generateClientNotification,
  type CascadeResult
} from "@/lib/cascade-scheduler";

type ViewMode = "month" | "week" | "day";

type PendingMove = {
  job: Job;
  targetDate: string;
  targetTime: string;
};

type Conflict = {
  job: Job;
  reason: string;
};

const START_HOUR = 7;
const END_HOUR = 19;
const HOUR_HEIGHT = 56;
const MIN_SLOT = 15;

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseJobDate(job: Job) {
  const value = job.scheduledAt || job.date;
  if (!value) {
    return new Date();
  }

  const raw = String(value);
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

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function getDurationHours(job: Job) {
  return job.hours ? Number(job.hours) : 3;
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function formatTimeRange(job: Job) {
  const start = parseJobDate(job);
  const duration = getDurationHours(job);
  const end = addMinutes(start, Math.round(duration * 60));
  return `${formatTime(start)} - ${formatTime(end)}`;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function snapMinutes(value: number) {
  return Math.round(value / MIN_SLOT) * MIN_SLOT;
}

function snapTimeValue(time: string) {
  return minutesToTime(snapMinutes(timeToMinutes(time)));
}

function formatMinutesLabel(totalMinutes: number) {
  const date = new Date();
  date.setHours(0, totalMinutes, 0, 0);
  return formatTime(date);
}

type PositionedJob = {
  job: Job;
  top: number;
  height: number;
  left: number;
  width: number;
};

function layoutDayJobs(dayJobs: Job[]): PositionedJob[] {
  const totalMinutes = (END_HOUR - START_HOUR + 1) * 60;
  const events = dayJobs
    .map((job) => {
      const startDate = parseJobDate(job);
      const durationMinutes = Math.round(getDurationHours(job) * 60);
      const startMinutes =
        (startDate.getHours() - START_HOUR) * 60 + startDate.getMinutes();
      const clampedStart = clamp(startMinutes, 0, totalMinutes);
      const clampedEnd = clamp(clampedStart + durationMinutes, 0, totalMinutes);
      return {
        job,
        start: clampedStart,
        end: Math.max(clampedEnd, clampedStart + MIN_SLOT)
      };
    })
    .sort((a, b) => a.start - b.start);

  const clusters: typeof events[] = [];
  let currentCluster: typeof events = [];
  let clusterEnd = -1;

  events.forEach((event) => {
    if (currentCluster.length === 0 || event.start < clusterEnd) {
      currentCluster.push(event);
      clusterEnd = Math.max(clusterEnd, event.end);
      return;
    }

    clusters.push(currentCluster);
    currentCluster = [event];
    clusterEnd = event.end;
  });

  if (currentCluster.length) {
    clusters.push(currentCluster);
  }

  const positioned: PositionedJob[] = [];

  clusters.forEach((cluster) => {
    const columns: number[] = [];
    const eventColumns = new Map<string, number>();

    cluster.forEach((event) => {
      let placed = false;
      for (let i = 0; i < columns.length; i += 1) {
        if (event.start >= columns[i]) {
          columns[i] = event.end;
          eventColumns.set(event.job.id, i);
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push(event.end);
        eventColumns.set(event.job.id, columns.length - 1);
      }
    });

    const columnCount = columns.length;

    cluster.forEach((event) => {
      const columnIndex = eventColumns.get(event.job.id) ?? 0;
      const width = 1 / columnCount;
      const left = columnIndex * width;
      positioned.push({
        job: event.job,
        top: (event.start / 60) * HOUR_HEIGHT,
        height: Math.max(((event.end - event.start) / 60) * HOUR_HEIGHT, 48),
        left,
        width
      });
    });
  });

  return positioned;
}

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:00`;
}
function JobChip({
  job,
  onSelect,
  onDragStart,
  onDragEnd,
  isDragging,
  className
}: {
  job: Job;
  onSelect: (job: Job) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, job: Job) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  className?: string;
}) {
  const team = job.cleaningTeam.length ? job.cleaningTeam.join(", ") : "Unassigned";
  const priceLabel = job.price
    ? `$${Number(job.price).toLocaleString("en-US")}`
    : "";
  const secondaryText = isDragging ? "text-blue-100" : "text-slate-600";
  const mutedText = isDragging ? "text-blue-100/90" : "text-slate-500";
  return (
    <button
      draggable
      onDragStart={(event) => onDragStart(event, job)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(job)}
      className={`w-full text-left text-xs rounded-md px-2.5 py-1.5 transition-all cursor-move ${className ?? ""} ${
        isDragging
          ? "bg-blue-600 text-white shadow-lg scale-105 rotate-1"
          : "bg-white text-slate-900 border border-slate-300 hover:border-blue-400 hover:shadow-sm"
      }`}
    >
      <div className="font-bold truncate mb-0.5">{job.client}</div>
      <div className={`flex items-center justify-between text-[10px] ${secondaryText} mb-0.5`}>
        <span className="font-medium">{formatTimeRange(job)}</span>
        <span className={`text-right tabular-nums font-semibold ${isDragging ? "text-blue-100" : "text-emerald-600"}`}>{priceLabel}</span>
      </div>
      <div className={`truncate text-[10px] ${mutedText}`}>{job.title}</div>
    </button>
  );
}

function DayDropZone({
  children,
  isActive,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop
}: {
  children: ReactNode;
  isActive: boolean;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`border-r border-b border-slate-200 p-2 min-h-[110px] transition-colors ${
        isActive ? "bg-blue-50/50 ring-2 ring-inset ring-blue-400" : "bg-white hover:bg-slate-50/50"
      }`}
    >
      {children}
    </div>
  );
}

function DayColumn({
  children,
  isActive,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop
}: {
  children: ReactNode;
  isActive: boolean;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative bg-white ${
        isActive ? "bg-blue-50/40" : ""
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
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverMinutes, setDragOverMinutes] = useState<number | null>(null);
  const lastDragPositionRef = useRef<{ date: string | null; minutes: number | null }>({ date: null, minutes: null });
  const [targetDate, setTargetDate] = useState("");
  const [targetTime, setTargetTime] = useState("09:00");
  const [teamInput, setTeamInput] = useState("");
  const [crewSize, setCrewSize] = useState(1);
  const [durationHours, setDurationHours] = useState(3);
  const [autoAdjustDuration, setAutoAdjustDuration] = useState(true);
  const [laborHours, setLaborHours] = useState(3);
  const [notifyMode, setNotifyMode] = useState<"ai" | "manual">("ai");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyClient, setNotifyClient] = useState(false);
  const [shiftDownstream, setShiftDownstream] = useState(false);
  const [notifyAffected, setNotifyAffected] = useState(false);
  const [panelWidth, setPanelWidth] = useState(420);
  const [resizing, setResizing] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<{ conflicts: Conflict[]; targetDate: string; targetTime: string; job: Job } | null>(null);
  const [showCascadeModal, setShowCascadeModal] = useState(false);
  const [cascadePreview, setCascadePreview] = useState<CascadeResult | null>(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationMessages, setNotificationMessages] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    async function fetchData() {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      setJobs(data.jobs);
      setIsLiveData(data.isLiveData);
    }

    fetchData();
  }, []);

  useEffect(() => {
    if (!pendingMove) {
      return;
    }

    const initialDuration = getDurationHours(pendingMove.job);
    const initialCrew = pendingMove.job.cleaningTeam.length || 1;

    setTargetDate(pendingMove.targetDate);
    setTargetTime(snapTimeValue(pendingMove.targetTime));
    setTeamInput(pendingMove.job.cleaningTeam.join(", "));
    setCrewSize(initialCrew);
    setDurationHours(initialDuration);
    setLaborHours(initialCrew * initialDuration);
    setNotifyMode("ai");
    setNotifyClient(false);
    setShiftDownstream(false);
    setNotifyAffected(false);
    setNotifyMessage(
      `Hi ${pendingMove.job.client}, we need to adjust your appointment. The team had a schedule change so your clean has been moved to ${formatDisplayDate(
        pendingMove.targetDate
      )} at ${pendingMove.targetTime}. Please reply if you need a different time.`
    );
  }, [pendingMove]);

  useEffect(() => {
    if (!resizing) {
      return;
    }

    const handleMove = (event: MouseEvent) => {
      const nextWidth = Math.min(720, Math.max(320, window.innerWidth - event.clientX));
      setPanelWidth(nextWidth);
    };
    const handleUp = () => setResizing(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizing]);

  useEffect(() => {
    if (!pendingMove || notifyMode !== "ai") {
      return;
    }

    const reasonText = rescheduleReason ? ` Reason: ${rescheduleReason}.` : "";
    setNotifyMessage(
      `Hi ${pendingMove.job.client}, your appointment has been moved to ${formatDisplayDate(
        targetDate
      )} at ${targetTime}.${reasonText} Reply if you need a different time.`
    );
  }, [notifyMode, pendingMove, rescheduleReason, targetDate, targetTime]);

  // Auto-recalculate duration when crew size changes
  useEffect(() => {
    if (!pendingMove) return;

    const originalCrew = pendingMove.job.cleaningTeam.length || 1;
    const newCrew = crewSize;

    if (originalCrew !== newCrew && autoAdjustDuration) {
      const newDuration = calculateDurationForTeamChange(
        getDurationHours(pendingMove.job),
        originalCrew,
        newCrew
      );
      setDurationHours(newDuration);
      setLaborHours(newCrew * newDuration);
    }
  }, [crewSize, pendingMove, autoAdjustDuration]);

  const jobsByDate = useMemo(() => {
    const map = new Map<string, Job[]>();
    // Only show scheduled jobs (jobs with cleaning team assigned)
    const scheduledJobs = jobs.filter(job => job.cleaningTeam && job.cleaningTeam.length > 0);
    scheduledJobs.forEach((job) => {
      const dateKey = toDateKey(parseJobDate(job));
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(job);
    });
    return map;
  }, [jobs]);

  const conflicts = useMemo(() => {
    if (!pendingMove) {
      return [] as Conflict[];
    }

    const nextStart = new Date(`${targetDate}T${targetTime}:00`);
    const nextEnd = addMinutes(nextStart, Math.round(durationHours * 60));
    const team = teamInput
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    return jobs
      .filter((job) => job.id !== pendingMove.job.id)
      .map((job) => {
        const jobStart = parseJobDate(job);
        const jobEnd = addMinutes(jobStart, Math.round(getDurationHours(job) * 60));
        const sameDay = toDateKey(jobStart) === toDateKey(nextStart);
        const overlap = sameDay && jobStart < nextEnd && jobEnd > nextStart;
        if (!overlap) {
          return null;
        }

        const teamOverlap = job.cleaningTeam.some((member) => team.includes(member));
        const reason = teamOverlap
          ? `Team conflict with ${job.client}`
          : `Time conflict with ${job.client}`;

        return { job, reason } as Conflict;
      })
      .filter(Boolean) as Conflict[];
  }, [pendingMove, jobs, targetDate, targetTime, durationHours, teamInput]);

  const downstreamJobs = useMemo(() => {
    if (!pendingMove) {
      return [] as Job[];
    }

    const originalStart = parseJobDate(pendingMove.job);
    const originalEnd = addMinutes(
      originalStart,
      Math.round(getDurationHours(pendingMove.job) * 60)
    );

    return jobs
      .filter((job) => job.id !== pendingMove.job.id)
      .filter((job) => {
        const jobStart = parseJobDate(job);
        return (
          toDateKey(jobStart) === toDateKey(originalStart) &&
          jobStart >= originalEnd
        );
      })
      .sort((a, b) => parseJobDate(a).getTime() - parseJobDate(b).getTime());
  }, [jobs, pendingMove]);

  const shiftMinutes = useMemo(() => {
    if (!pendingMove) {
      return 0;
    }

    const originalStart = parseJobDate(pendingMove.job);
    const originalEnd = addMinutes(
      originalStart,
      Math.round(getDurationHours(pendingMove.job) * 60)
    );
    const newStart = new Date(`${targetDate}T${targetTime}:00`);
    const newEnd = addMinutes(newStart, Math.round(durationHours * 60));
    const deltaMinutes = Math.round(
      (newEnd.getTime() - originalEnd.getTime()) / 60000
    );
    return Math.max(0, deltaMinutes);
  }, [pendingMove, targetDate, targetTime, durationHours]);

  const shiftedDownstream = useMemo(() => {
    if (!pendingMove || !shiftDownstream || shiftMinutes === 0) {
      return [] as { job: Job; newDate: string; newTime: string }[];
    }

    return downstreamJobs.map((job) => {
      const jobStart = parseJobDate(job);
      const shiftedStart = addMinutes(jobStart, shiftMinutes);
      return {
        job,
        newDate: toDateKey(shiftedStart),
        newTime: minutesToTime(
          shiftedStart.getHours() * 60 + shiftedStart.getMinutes()
        )
      };
    });
  }, [downstreamJobs, pendingMove, shiftDownstream, shiftMinutes]);

  const handleCrewSizeChange = (value: number) => {
    const nextCrew = Math.max(1, Math.round(value));
    setCrewSize(nextCrew);
    if (autoAdjustDuration && laborHours) {
      const nextDuration = Math.max(
        0.5,
        Math.round((laborHours / nextCrew) * 2) / 2
      );
      setDurationHours(nextDuration);
    } else {
      setLaborHours(nextCrew * durationHours);
    }
  };

  const handleDurationChange = (value: number) => {
    const nextDuration = Math.max(0.5, Math.round(value * 2) / 2);
    setDurationHours(nextDuration);
    setLaborHours(nextDuration * crewSize);
  };

  const handleAutoAdjustToggle = () => {
    const nextValue = !autoAdjustDuration;
    setAutoAdjustDuration(nextValue);
    if (nextValue) {
      const nextDuration = Math.max(
        0.5,
        Math.round((laborHours / crewSize) * 2) / 2
      );
      setDurationHours(nextDuration);
    }
  };

  const handleTeamInputChange = (value: string) => {
    setTeamInput(value);
    const count = value
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean).length;
    if (count > 0) {
      handleCrewSizeChange(count);
    }
  };

  const openReschedule = (job: Job) => {
    const jobStart = parseJobDate(job);
    const minutes = snapMinutes(jobStart.getHours() * 60 + jobStart.getMinutes());
    setPendingMove({
      job,
      targetDate: toDateKey(jobStart),
      targetTime: minutesToTime(minutes)
    });
    setSelectedJob(job);
    setRescheduleReason("");
    setSaveError("");
  };

  const focusInput = (id: string) => {
    const element = document.getElementById(id) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (element) {
      element.focus();
    }
  };

  const closePanel = () => {
    setPendingMove(null);
    setSelectedJob(null);
  };

  const handleOverrideConflict = async () => {
    if (!conflictDetails) return;

    const { job, targetDate, targetTime } = conflictDetails;
    const updatedDateTime = formatLocalDateTime(
      new Date(`${targetDate}T${targetTime}:00`)
    );
    const originalDate = job.date;
    const originalScheduledAt = job.scheduledAt;

    setShowConflictModal(false);
    setConflictDetails(null);
    setSaveError("");

    // Optimistically update UI
    setJobs((prev) =>
      prev.map((item) =>
        item.id === job.id
          ? {
              ...item,
              date: updatedDateTime,
              scheduledAt: updatedDateTime
            }
          : item
      )
    );

    try {
      const response = await fetch(`/api/jobs/${job.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: targetDate,
          startTime: targetTime,
          hours: job.hours,
          cleaningTeam: job.cleaningTeam
        })
      });

      if (!response.ok) {
        throw new Error("Failed to reschedule job");
      }
    } catch (error) {
      // Revert on error
      setJobs((prev) =>
        prev.map((item) =>
          item.id === job.id
            ? {
                ...item,
                date: originalDate,
                scheduledAt: originalScheduledAt
              }
            : item
        )
      );
      setSaveError("Override failed. Please try again.");
    }
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, job: Job) => {
    event.dataTransfer.setData("text/plain", job.id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingJobId(job.id);
  };

  const handleDragEnd = () => {
    setDraggingJobId(null);
    setDragOverDate(null);
    setDragOverMinutes(null);
    lastDragPositionRef.current = { date: null, minutes: null };
  };

  const handleDrop = async (
    dateKey: string,
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    const jobId = event.dataTransfer.getData("text/plain");
    const job = jobs.find((item) => item.id === jobId);

    if (!job) {
      setSaveError("Drop failed. Please try again.");
      return;
    }

    const currentDateKey = toDateKey(parseJobDate(job));
    const existingMinutes =
      Math.round(parseJobDate(job).getHours() * 60 + parseJobDate(job).getMinutes());
    const snappedExistingMinutes = snapMinutes(existingMinutes);

    const dropMinutes =
      dragOverMinutes !== null
        ? snapMinutes(START_HOUR * 60 + dragOverMinutes)
        : snappedExistingMinutes;

    if (currentDateKey === dateKey && dropMinutes === snappedExistingMinutes) {
      setSaveError("Drop cancelled: same time selected.");
      setDraggingJobId(null);
      setDragOverDate(null);
      setDragOverMinutes(null);
      return;
    }

    const targetTimeValue = minutesToTime(dropMinutes);

    // Check for conflicts
    const nextStart = new Date(`${dateKey}T${targetTimeValue}:00`);
    const nextEnd = addMinutes(nextStart, Math.round(getDurationHours(job) * 60));

    const detectedConflicts = jobs
      .filter((otherJob) => otherJob.id !== job.id)
      .map((otherJob) => {
        const jobStart = parseJobDate(otherJob);
        const jobEnd = addMinutes(jobStart, Math.round(getDurationHours(otherJob) * 60));
        const sameDay = toDateKey(jobStart) === toDateKey(nextStart);
        const overlap = sameDay && jobStart < nextEnd && jobEnd > nextStart;
        if (!overlap) {
          return null;
        }

        const teamOverlap = otherJob.cleaningTeam.some((member) => job.cleaningTeam.includes(member));
        const reason = teamOverlap
          ? `Team conflict with ${otherJob.client}`
          : `Time conflict with ${otherJob.client}`;

        return { job: otherJob, reason } as Conflict;
      })
      .filter(Boolean) as Conflict[];

    if (detectedConflicts.length > 0) {
      setConflictDetails({ conflicts: detectedConflicts, targetDate: dateKey, targetTime: targetTimeValue, job });
      setShowConflictModal(true);
      setDraggingJobId(null);
      setDragOverDate(null);
      setDragOverMinutes(null);
      return;
    }

    const updatedDateTime = formatLocalDateTime(
      new Date(`${dateKey}T${targetTimeValue}:00`)
    );
    const originalDate = job.date;
    const originalScheduledAt = job.scheduledAt;

    setSaveError("");
    setJobs((prev) =>
      prev.map((item) =>
        item.id === job.id
          ? {
              ...item,
              date: updatedDateTime,
              scheduledAt: updatedDateTime
            }
          : item
      )
    );
    setDraggingJobId(null);
    setDragOverDate(null);
    setDragOverMinutes(null);

    try {
      const response = await fetch(`/api/jobs/${job.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateKey,
          startTime: targetTimeValue,
          hours: job.hours,
          cleaningTeam: job.cleaningTeam
        })
      });

      if (!response.ok) {
        throw new Error("Failed to reschedule job");
      }
    } catch (error) {
      setJobs((prev) =>
        prev.map((item) =>
          item.id === job.id
            ? {
                ...item,
                date: originalDate,
                scheduledAt: originalScheduledAt
              }
            : item
        )
      );
      setSaveError("Reschedule failed. Please try again.");
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleColumnDragOver = (
    dateKey: string,
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = clamp(event.clientY - rect.top, 0, rect.height);
    const totalMinutes = (END_HOUR - START_HOUR + 1) * 60;
    const rawMinutes = (offsetY / rect.height) * totalMinutes;
    const minutes = clamp(
      snapMinutes(rawMinutes),
      0,
      totalMinutes - MIN_SLOT
    );

    // Only update state if the snapped position has changed
    if (
      lastDragPositionRef.current.date !== dateKey ||
      lastDragPositionRef.current.minutes !== minutes
    ) {
      lastDragPositionRef.current = { date: dateKey, minutes };
      setDragOverDate(dateKey);
      setDragOverMinutes(minutes);
    }
  };

  const handleRescheduleConfirm = async () => {
    if (!pendingMove) {
      return;
    }

    // Calculate cascade before confirming
    const newStartTime = new Date(`${targetDate}T${targetTime}:00`);
    const cascade = calculateCascade(
      pendingMove.job,
      newStartTime,
      durationHours,
      jobs
    );

    // If there are cascaded changes or conflicts, show preview modal
    if (cascade.changes.length > 1 || cascade.conflicts.length > 0) {
      setCascadePreview(cascade);
      setShowCascadeModal(true);
      return; // Don't proceed yet - wait for user confirmation
    }

    // No cascade needed, proceed directly
    await executeReschedule();
  };

  const executeReschedule = async (applyCascade = false) => {
    if (!pendingMove) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setShowCascadeModal(false);

    try {
      const teamList = teamInput
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      const updatedDateTime = formatLocalDateTime(
        new Date(`${targetDate}T${targetTime}:00`)
      );

      const sendReschedule = async (
        jobId: string,
        payload: {
          date: string;
          startTime?: string;
          hours?: number;
          cleaningTeam?: string[];
          reason?: string;
          notifyClient?: boolean;
          notifyMessage?: string;
        }
      ) => {
        const response = await fetch(`/api/jobs/${jobId}/reschedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error("Failed to reschedule job");
        }
      };

      // Send primary reschedule
      await sendReschedule(pendingMove.job.id, {
        date: targetDate,
        startTime: targetTime,
        hours: durationHours,
        cleaningTeam: teamList,
        reason: rescheduleReason,
        notifyClient,
        notifyMessage: notifyClient ? notifyMessage : ""
      });

      // Apply cascade changes if confirmed
      if (applyCascade && cascadePreview) {
        const cascadedChanges = cascadePreview.changes.slice(1); // Skip first (primary) change

        for (const change of cascadedChanges) {
          const newDate = toDateKey(change.newStart);
          const newTime = minutesToTime(
            change.newStart.getHours() * 60 + change.newStart.getMinutes()
          );

          const message = notificationMessages.get(change.job.client) || "";

          await sendReschedule(change.job.id, {
            date: newDate,
            startTime: newTime,
            hours: change.newDuration,
            reason: change.reason,
            notifyClient: message.length > 0,
            notifyMessage: message
          });
        }
      }

      // Update UI optimistically
      setJobs((prev) =>
        prev.map((job) => {
          if (job.id === pendingMove.job.id) {
            return {
              ...job,
              date: updatedDateTime,
              scheduledAt: updatedDateTime,
              hours: durationHours,
              cleaningTeam: teamList
            };
          }

          if (applyCascade && cascadePreview) {
            const change = cascadePreview.changes.find(c => c.job.id === job.id);
            if (change && change.job.id !== pendingMove.job.id) {
              const newDateTime = formatLocalDateTime(change.newStart);
              return {
                ...job,
                date: newDateTime,
                scheduledAt: newDateTime,
                hours: change.newDuration
              };
            }
          }

          return job;
        })
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

  const timeOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (
      let minutes = START_HOUR * 60;
      minutes <= END_HOUR * 60;
      minutes += MIN_SLOT
    ) {
      options.push({
        value: minutesToTime(minutes),
        label: formatMinutesLabel(minutes)
      });
    }
    return options;
  }, []);

  const panelJob = pendingMove?.job ?? selectedJob;
  const panelOpen = Boolean(panelJob);
  const panelTeam =
    panelJob && panelJob.cleaningTeam.length
      ? panelJob.cleaningTeam.join(", ")
      : "Unassigned";
  const panelStart = panelJob ? parseJobDate(panelJob) : null;
  const panelDuration = panelJob ? getDurationHours(panelJob) : 0;
  const panelEnd = panelStart
    ? addMinutes(panelStart, Math.round(panelDuration * 60))
    : null;
  const previewStart = pendingMove
    ? new Date(`${targetDate}T${targetTime}:00`)
    : panelStart;
  const previewEnd = previewStart
    ? addMinutes(
        previewStart,
        Math.round((pendingMove ? durationHours : panelDuration) * 60)
      )
    : null;

  return (
    <div className="min-h-screen bg-white p-6 md:p-8 text-slate-900">
      <div
        className="max-w-7xl mx-auto space-y-4"
        style={{
          paddingRight: panelOpen ? panelWidth + 24 : undefined
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Calendar Schedule</h1>
            <p className="text-sm text-slate-600 mt-1">
              Drag & drop jobs to reschedule • 15-minute time slots
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isLiveData && (
              <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs">
                DEMO MODE
              </Badge>
            )}
            <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-0.5 text-xs shadow-sm">
              {["month", "week", "day"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as ViewMode)}
                  className={`px-3 py-1.5 rounded-md uppercase tracking-wide font-medium transition-all ${
                    viewMode === mode
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        {saveError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 flex items-center gap-2 shadow-sm">
            <span className="text-rose-600 font-semibold">⚠</span>
            {saveError}
          </div>
        )}

        {viewMode === "month" && (
          <div className="rounded-lg border border-slate-300 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-md border border-slate-200 transition-all"
              >
                ← Previous
              </button>
              <h2 className="text-base font-semibold text-slate-900">{monthName}</h2>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-md border border-slate-200 transition-all"
              >
                Next →
              </button>
            </div>

            <div className="p-3">
              <div className="grid grid-cols-7 gap-0 mb-1 border-b border-slate-300">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-bold text-slate-700 py-2 uppercase tracking-wide bg-slate-50"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0 border border-slate-300">
                {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[110px] border-r border-b border-slate-200 bg-slate-50/30"
                  />
                ))}

                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const date = idx + 1;
                  const dateKey = toDateKey(new Date(year, month, date));
                  const dayJobs = jobsByDate.get(dateKey) || [];
                  const isToday =
                    new Date().getDate() === date &&
                    new Date().getMonth() === month &&
                    new Date().getFullYear() === year;
                  const isWeekend = [0, 6].includes(new Date(year, month, date).getDay());

                  return (
                    <DayDropZone
                      key={dateKey}
                      isActive={dragOverDate === dateKey}
                      onDragOver={handleDragOver}
                      onDragEnter={() => {
                        setDragOverDate(dateKey);
                        setDragOverMinutes(null);
                      }}
                      onDragLeave={() => {
                        setDragOverDate(null);
                        setDragOverMinutes(null);
                      }}
                      onDrop={(event) => handleDrop(dateKey, event)}
                    >
                      <div
                        className={`text-xs font-bold mb-2 px-2 py-1 ${
                          isToday
                            ? "text-blue-600 bg-blue-50 rounded-md"
                            : isWeekend
                            ? "text-slate-400"
                            : "text-slate-600"
                        }`}
                      >
                        {date}
                      </div>
                      <div className="space-y-1.5 px-1">
                        {dayJobs.map((job) => (
                          <JobChip
                            key={job.id}
                            job={job}
                            onSelect={setSelectedJob}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            isDragging={draggingJobId === job.id}
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
          <div className="rounded-lg border border-slate-300 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
              <button
                onClick={() =>
                  setCurrentDate(addDays(currentDate, viewMode === "day" ? -1 : -7))
                }
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-md border border-slate-200 transition-all"
              >
                ← Previous
              </button>
              <h2 className="text-base font-semibold text-slate-900">
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
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-md border border-slate-200 transition-all"
              >
                Next →
              </button>
            </div>

            <div className="grid grid-cols-[60px_1fr] border-t border-slate-200">
              <div className="border-r border-slate-200 bg-white">
                {dayHours.map((hour) => {
                  const time = new Date();
                  time.setHours(hour, 0, 0, 0);
                  return (
                    <div
                      key={hour}
                      className="h-14 border-b border-slate-100 text-[11px] font-medium text-slate-400 flex items-start justify-end pr-2 -mt-2"
                    >
                      {formatTime(time)}
                    </div>
                  );
                })}
              </div>

              <div
                className={`grid ${
                  viewMode === "day" ? "grid-cols-1" : "grid-cols-7"
                } gap-0`}
              >
                {(viewMode === "day" ? [currentDate] : weekDays).map((day, dayIndex) => {
                  const dateKey = toDateKey(day);
                  const dayJobs = jobsByDate.get(dateKey) || [];
                  const isToday = toDateKey(new Date()) === dateKey;
                  const dayOfWeek = day.toLocaleDateString("en-US", { weekday: "short" });
                  const dayNum = day.getDate();

                  return (
                    <div key={dateKey} className={dayIndex > 0 ? "border-l border-slate-200" : ""}>
                      <div className={`text-center py-2 border-b border-slate-200 bg-white`}>
                        <div className={`text-[11px] font-medium uppercase ${isToday ? "text-blue-600" : "text-slate-500"}`}>
                          {dayOfWeek}
                        </div>
                        <div className={`text-2xl font-normal ${isToday ? "bg-blue-600 text-white w-10 h-10 rounded-full mx-auto flex items-center justify-center" : "text-slate-900"}`}>
                          {dayNum}
                        </div>
                      </div>
                      <DayColumn
                        isActive={dragOverDate === dateKey}
                        onDragOver={(event) => handleColumnDragOver(dateKey, event)}
                        onDragEnter={() => setDragOverDate(dateKey)}
                        onDragLeave={() => {
                          setDragOverDate(null);
                          setDragOverMinutes(null);
                        }}
                        onDrop={(event) => handleDrop(dateKey, event)}
                      >
                        {dayHours.map((hour) => (
                          <div
                            key={`${dateKey}-${hour}`}
                            className="border-b border-slate-100 bg-white"
                            style={{ height: HOUR_HEIGHT }}
                          />
                        ))}
                        {dragOverDate === dateKey && dragOverMinutes !== null && (
                          <div
                            className="absolute left-2 right-2 z-20 drag-indicator-smooth"
                            style={{ top: (dragOverMinutes / 60) * HOUR_HEIGHT }}
                          >
                            <div className="flex items-center gap-2 text-[10px] text-blue-600">
                              <div className="h-px flex-1 bg-blue-300" />
                              <span className="rounded-full bg-white px-2 py-0.5 text-blue-600 border border-blue-300">
                                {formatMinutesLabel(START_HOUR * 60 + dragOverMinutes)}
                              </span>
                              <div className="h-px flex-1 bg-blue-300" />
                            </div>
                          </div>
                        )}
                        {layoutDayJobs(dayJobs).map(
                          ({ job, top, height, left, width }) => {
                            const leftPercent = left * 100;
                            const widthPercent = width * 100;
                            return (
                              <div
                                key={job.id}
                                className="absolute"
                                style={{
                                  top,
                                  height,
                                  left: `calc(${leftPercent}% + 6px)`,
                                  width: `calc(${widthPercent}% - 12px)`
                                }}
                              >
                                <JobChip
                                  job={job}
                                  onSelect={setSelectedJob}
                                  onDragStart={handleDragStart}
                                  onDragEnd={handleDragEnd}
                                  isDragging={draggingJobId === job.id}
                                  className="h-full flex flex-col justify-between"
                                />
                              </div>
                            );
                          }
                        )}
                      </DayColumn>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {panelOpen && panelJob && (
        <aside
          className="fixed top-0 right-0 z-40 h-full border-l-2 border-slate-300 bg-white shadow-xl"
          style={{ width: panelWidth }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize bg-slate-300 hover:bg-blue-400 transition-colors"
            onMouseDown={() => setResizing(true)}
          />
          <div className="flex items-start justify-between bg-slate-50 border-b-2 border-slate-300 px-5 py-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                Job Details
              </div>
              <div className="text-lg font-bold text-slate-900">
                {panelJob.client}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">{panelJob.title}</div>
            </div>
            <button
              onClick={closePanel}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:shadow-sm transition-all"
            >
              ✕ Close
            </button>
          </div>

          <div className="h-[calc(100%-72px)] overflow-y-auto p-5 space-y-5">
            <section className="rounded-lg border border-slate-300 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  Schedule
                </span>
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-md bg-slate-200 text-slate-700 font-semibold">
                  {panelJob.status}
                </span>
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {panelStart
                  ? formatDisplayDate(toDateKey(panelStart))
                  : "No date set"}
              </div>
              <div className="text-xs text-slate-600 font-medium">
                {panelStart && panelEnd
                  ? `${formatTime(panelStart)} - ${formatTime(panelEnd)}`
                  : "Time not set"}
              </div>
              <div className="text-xs text-slate-600">
                <span className="font-semibold">Team:</span> {panelTeam}
              </div>
              <div className="flex flex-wrap gap-2 text-xs pt-2 border-t border-slate-200">
                <span
                  className={`rounded-md px-2.5 py-1 font-medium border ${
                    panelJob.cleaningTeam && panelJob.cleaningTeam.length > 0
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : panelJob.email
                      ? "bg-slate-100 text-slate-700 border-slate-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {panelJob.cleaningTeam && panelJob.cleaningTeam.length > 0
                    ? "Scheduled"
                    : panelJob.email
                    ? "Quoted"
                    : "New Lead"}
                </span>
                <span
                  className={`rounded-md px-2.5 py-1 font-medium border ${
                    panelJob.paid
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {panelJob.paid ? "✓ Paid" : "Unpaid"}
                </span>
                <span className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-700 font-medium">
                  {panelJob.hours ? `${panelJob.hours} hrs` : "Hours TBD"}
                </span>
                <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-emerald-700 font-semibold">
                  ${panelJob.price || 0}
                </span>
              </div>
            </section>

            {!pendingMove && (
              <button
                onClick={() => openReschedule(panelJob)}
                className="w-full rounded-lg border-2 border-blue-300 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-400 shadow-sm hover:shadow transition-all"
              >
                📅 Reschedule Job
              </button>
            )}

            {pendingMove && (
              <section className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4 space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-widest text-blue-700 font-bold">
                    📅 Reschedule Form
                  </span>
                  <span className="text-xs text-slate-700 font-semibold bg-white px-2 py-1 rounded-md border border-slate-200">
                    {previewStart && previewEnd
                      ? `${formatTime(previewStart)} - ${formatTime(previewEnd)}`
                      : "Select time"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-700 font-semibold">
                    Date
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(event) => setTargetDate(event.target.value)}
                      className="mt-1.5 w-full rounded-md border-2 border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </label>
                  <label className="text-xs text-slate-700 font-semibold">
                    Start time
                    <select
                      id="time-input"
                      value={targetTime}
                      onChange={(event) =>
                        setTargetTime(snapTimeValue(event.target.value))
                      }
                      className="mt-1.5 w-full rounded-md border-2 border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    >
                      {timeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-600">
                    Crew size
                    <input
                      type="number"
                      min={1}
                      value={crewSize}
                      onChange={(event) =>
                        handleCrewSizeChange(Number(event.target.value || 1))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Duration (hrs)
                    <input
                      type="number"
                      step={0.5}
                      min={0.5}
                      value={durationHours}
                      onChange={(event) =>
                        handleDurationChange(Number(event.target.value || 0))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Labor hours: {laborHours.toFixed(1)}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoAdjustDuration}
                      onChange={handleAutoAdjustToggle}
                      className="accent-blue-500"
                    />
                    Auto adjust duration
                  </label>
                </div>

                <label className="text-xs text-slate-600">
                  Assigned team
                  <input
                    id="team-input"
                    type="text"
                    value={teamInput}
                    onChange={(event) => handleTeamInputChange(event.target.value)}
                    placeholder="Names separated by commas"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </label>

                {conflicts.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="uppercase tracking-widest">
                        Conflicts
                      </span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => focusInput("time-input")}
                          className="rounded-full border border-amber-300 px-2 py-1 hover:bg-amber-100"
                        >
                          Adjust time
                        </button>
                        <button
                          type="button"
                          onClick={() => focusInput("team-input")}
                          className="rounded-full border border-amber-300 px-2 py-1 hover:bg-amber-100"
                        >
                          Reassign team
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotifyClient(true)}
                          className="rounded-full border border-amber-300 px-2 py-1 hover:bg-amber-100"
                        >
                          Notify client
                        </button>
                      </div>
                    </div>
                    {conflicts.map((conflict) => (
                      <div
                        key={conflict.job.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span>{conflict.reason}</span>
                        <span className="text-amber-700">
                          {formatTimeRange(conflict.job)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {downstreamJobs.length > 0 && shiftMinutes > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={shiftDownstream}
                        onChange={(event) => setShiftDownstream(event.target.checked)}
                        className="accent-blue-500"
                      />
                      Shift following jobs by {shiftMinutes} minutes
                    </label>

                    {shiftDownstream && (
                      <>
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={notifyAffected}
                            onChange={(event) =>
                              setNotifyAffected(event.target.checked)
                            }
                            className="accent-blue-500"
                          />
                          Notify affected clients
                        </label>

                        <div className="space-y-1 text-xs text-slate-500">
                          {shiftedDownstream.map((shift) => (
                            <div
                              key={shift.job.id}
                              className="flex items-center justify-between"
                            >
                              <span className="truncate">{shift.job.client}</span>
                              <span className="text-slate-500">
                                {shift.newTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <label className="text-xs text-slate-600">
                  Reschedule reason
                  <textarea
                    value={rescheduleReason}
                    onChange={(event) => setRescheduleReason(event.target.value)}
                    placeholder="Add a quick note for internal tracking"
                    className="mt-1 min-h-[70px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500">
                      Client Notification
                    </span>
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={notifyClient}
                        onChange={(event) => setNotifyClient(event.target.checked)}
                        className="accent-blue-500"
                      />
                      Notify client
                    </label>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setNotifyMode("ai")}
                      className={`rounded-full px-3 py-1 ${
                        notifyMode === "ai"
                          ? "bg-blue-500 text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                    >
                      AI draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifyMode("manual")}
                      className={`rounded-full px-3 py-1 ${
                        notifyMode === "manual"
                          ? "bg-blue-500 text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                    >
                      Manual
                    </button>
                  </div>

                  <textarea
                    value={notifyMessage}
                    onChange={(event) => setNotifyMessage(event.target.value)}
                    disabled={!notifyClient}
                    className="min-h-[110px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50"
                  />
                </div>

                {saveError && (
                  <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 flex items-center gap-2">
                    <span className="font-bold">⚠</span>
                    {saveError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleRescheduleConfirm}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Saving...
                      </>
                    ) : (
                      <>
                        ✓ Confirm Reschedule
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingMove(null)}
                    disabled={saving}
                    className="rounded-lg border-2 border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:border-slate-400 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}
          </div>
        </aside>
      )}

      {/* Cascade Preview Modal */}
      {showCascadeModal && cascadePreview && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Schedule Cascade Detected
                </h2>
                <p className="text-sm text-slate-600 mt-2">
                  This change will affect {cascadePreview.changes.length - 1} other job{cascadePreview.changes.length > 2 ? "s" : ""} on the same day
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCascadeModal(false);
                  setCascadePreview(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-xl w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
              >
                X
              </button>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
              <h3 className="text-sm font-semibold text-blue-700 mb-2">
                What Changed
              </h3>
              <p className="text-sm text-slate-700 whitespace-pre-line">
                {cascadePreview.summary}
              </p>
            </div>

            {/* Conflicts */}
            {cascadePreview.conflicts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-amber-700 uppercase tracking-wider">
                  Conflicts ({cascadePreview.conflicts.length})
                </h3>
                {cascadePreview.conflicts.map((conflict, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl p-4 bg-amber-50 border border-amber-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-amber-900">
                        {conflict.job.client}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                        {conflict.severity}
                      </span>
                    </div>
                    <div className="text-sm text-amber-800">
                      {conflict.reason}
                    </div>
                  </div>
                ))}
                <div className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3 border border-amber-200">
                  These conflicts must be resolved before proceeding. Consider choosing a different time or manually adjusting the conflicting jobs.
                </div>
              </div>
            )}

            {/* Affected Jobs */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Affected Appointments ({cascadePreview.changes.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cascadePreview.changes.map((change, idx) => (
                  <div
                    key={change.job.id}
                    className={`rounded-xl p-4 ${
                      idx === 0
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-white border border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {change.job.client}
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {change.job.title}
                        </div>
                        {change.deltaMinutes !== 0 && (
                          <div className="text-sm text-slate-700">
                            {formatTime(change.originalStart)} to {formatTime(change.newStart)}
                            <span
                              className={`ml-2 text-xs ${
                                change.deltaMinutes > 0
                                  ? "text-amber-600"
                                  : "text-blue-600"
                              }`}
                            >
                              ({change.deltaMinutes > 0 ? "+" : ""}{change.deltaMinutes} min)
                            </span>
                          </div>
                        )}
                        {change.originalDuration !== change.newDuration && (
                          <div className="text-xs text-slate-500">
                            Duration: {change.originalDuration}h to {change.newDuration}h
                          </div>
                        )}
                      </div>
                    </div>
                    {idx > 0 && (
                      <div className="mt-2 text-xs text-slate-500 italic">
                        Reason: {change.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Client Notifications */}
            {cascadePreview.changes.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                  Client Notifications ({cascadePreview.affectedClients.length} client{cascadePreview.affectedClients.length > 1 ? "s" : ""})
                </h3>
                <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
                  After confirming these changes, you'll be able to send automated notifications to all affected clients explaining the schedule adjustment.
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              {cascadePreview.conflicts.length > 0 ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowCascadeModal(false);
                      setCascadePreview(null);
                    }}
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    Cancel & Choose Different Time
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-xs text-slate-600 px-2">
                    No conflicts detected. You can proceed with these automatic adjustments.
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowCascadeModal(false);
                        setCascadePreview(null);
                      }}
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:border-slate-400 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        await executeReschedule(true);
                        // After executing, show notification prompt
                        if (cascadePreview.affectedClients.length > 1) {
                          // Generate default messages
                          const messages = new Map<string, string>();
                          cascadePreview.changes.forEach(change => {
                            if (change.job.client) {
                              const msg = generateClientNotification(
                                change.job.client,
                                change,
                                rescheduleReason || "schedule adjustment"
                              );
                              messages.set(change.job.client, msg);
                            }
                          });
                          setNotificationMessages(messages);
                          setShowNotificationPrompt(true);
                        }
                      }}
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                    >
                      Confirm & Apply Changes
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showConflictModal && conflictDetails && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Scheduling Conflict Detected
                </h2>
                <p className="text-sm text-slate-600 mt-2">
                  The selected time conflicts with existing appointments
                </p>
              </div>
              <button
                onClick={() => {
                  setShowConflictModal(false);
                  setConflictDetails(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-xl w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
              >
                X
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Conflicts ({conflictDetails.conflicts.length})
              </h3>
              <div className="space-y-3">
                {conflictDetails.conflicts.map((conflict) => (
                  <div
                    key={conflict.job.id}
                    className="rounded-xl p-4 bg-amber-50 border border-amber-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-amber-900">
                        {conflict.job.client}
                      </span>
                      <span className="text-xs text-amber-800">
                        {formatTimeRange(conflict.job)}
                      </span>
                    </div>
                    <div className="text-sm text-amber-800">
                      {conflict.reason}
                    </div>
                    <div className="text-xs text-amber-700 mt-1">
                      {conflict.job.title} - Team: {conflict.job.cleaningTeam.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <div className="text-xs text-slate-600 px-2">
                Scheduling this job will create conflicts with the appointments shown above. You can either choose a different time or override the conflict.
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowConflictModal(false);
                    setConflictDetails(null);
                  }}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:border-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverrideConflict}
                  className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 transition-colors"
                >
                  Override Conflict
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
