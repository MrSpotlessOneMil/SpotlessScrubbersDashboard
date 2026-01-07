
"use client";

import {
  useEffect,
  useMemo,
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
const MIN_SLOT = 5;

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
        end: Math.max(clampedEnd, clampedStart + 15)
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
  return (
    <button
      draggable
      onDragStart={(event) => onDragStart(event, job)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(job)}
      className={`w-full text-left text-xs rounded-lg px-2 py-1 transition-all ${className ?? ""} ${
        isDragging
          ? "bg-blue-600 text-white shadow-lg"
          : "bg-blue-600/15 text-blue-50 hover:bg-blue-600/30"
      }`}
    >
      <div className="font-semibold truncate">{job.client}</div>
      <div className="text-[10px] uppercase tracking-wide text-blue-100/70">
        {formatTimeRange(job)}
      </div>
      <div className="truncate opacity-80">{job.title}</div>
      <div className="text-[10px] text-blue-100/70">Team: {team}</div>
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
      className={`rounded-lg border border-zinc-800/40 p-2 min-h-[120px] transition-colors ${
        isActive ? "bg-blue-500/10 border-blue-500/60" : "bg-zinc-950/40"
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
      className={`relative rounded-xl border border-zinc-800/40 bg-zinc-950/40 ${
        isActive ? "ring-1 ring-blue-400/60" : ""
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
    setTargetTime(pendingMove.targetTime);
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
    const minutes = jobStart.getHours() * 60 + jobStart.getMinutes();
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
    const existingTime = minutesToTime(
      Math.round(parseJobDate(job).getHours() * 60 + parseJobDate(job).getMinutes())
    );

    const dropMinutes =
      dragOverMinutes !== null
        ? START_HOUR * 60 + dragOverMinutes
        : timeToMinutes(existingTime);

    if (currentDateKey === dateKey && dropMinutes === timeToMinutes(existingTime)) {
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
    const minutes = clamp(
      Math.round((offsetY / rect.height) * totalMinutes),
      0,
      totalMinutes - 1
    );
    setDragOverDate(dateKey);
    setDragOverMinutes(minutes);
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
    <div className="p-8">
      <div
        className="max-w-7xl mx-auto space-y-6"
        style={{
          paddingRight: panelOpen ? panelWidth + 24 : undefined
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-100">Calendar</h1>
            <p className="text-sm text-zinc-500">
              Drag jobs to reschedule with precise time control.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isLiveData && (
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                MOCK DATA
              </Badge>
            )}
            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 p-1 text-xs">
              {["month", "week", "day"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as ViewMode)}
                  className={`px-3 py-1 rounded-full uppercase tracking-wider transition-colors ${
                    viewMode === mode
                      ? "bg-blue-600 text-white"
                      : "text-zinc-500 hover:text-zinc-100"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        {saveError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {saveError}
          </div>
        )}

        {viewMode === "month" && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 rounded-lg transition-colors"
              >
                Previous
              </button>
              <h2 className="text-lg font-semibold text-zinc-100">{monthName}</h2>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 rounded-lg transition-colors"
              >
                Next
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-semibold text-zinc-500 py-2"
                  >
                    {day}
                  </div>
                ))}
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
                        className={`text-xs font-semibold mb-2 ${
                          isToday ? "text-blue-300" : "text-zinc-500"
                        }`}
                      >
                        {date}
                      </div>
                      <div className="space-y-2">
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <button
                onClick={() =>
                  setCurrentDate(addDays(currentDate, viewMode === "day" ? -1 : -7))
                }
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 rounded-lg transition-colors"
              >
                Previous
              </button>
              <h2 className="text-lg font-semibold text-zinc-100">
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
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 rounded-lg transition-colors"
              >
                Next
              </button>
            </div>

            <div className="grid grid-cols-[80px_1fr]">
              <div className="border-r border-zinc-800">
                {dayHours.map((hour) => {
                  const time = new Date();
                  time.setHours(hour, 0, 0, 0);
                  const formatted = time.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit"
                  });
                  return (
                    <div
                      key={hour}
                      className="h-14 border-b border-zinc-800/60 text-xs text-zinc-500 flex items-start justify-center pt-2"
                    >
                      {formatted}
                    </div>
                  );
                })}
              </div>

              <div
                className={`grid ${
                  viewMode === "day" ? "grid-cols-1" : "grid-cols-7"
                } gap-4 p-4`}
              >
                {(viewMode === "day" ? [currentDate] : weekDays).map((day) => {
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
                            className="border-b border-zinc-800/40"
                            style={{ height: HOUR_HEIGHT }}
                          />
                        ))}
                        {dragOverDate === dateKey && dragOverMinutes !== null && (
                          <div
                            className="absolute left-2 right-2 z-20"
                            style={{ top: (dragOverMinutes / 60) * HOUR_HEIGHT }}
                          >
                            <div className="flex items-center gap-2 text-[10px] text-blue-200">
                              <div className="h-px flex-1 bg-blue-400/60" />
                              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-white">
                                {minutesToTime(START_HOUR * 60 + dragOverMinutes)}
                              </span>
                              <div className="h-px flex-1 bg-blue-400/60" />
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
          className="fixed top-0 right-0 z-40 h-full border-l border-zinc-800 bg-zinc-950/95 backdrop-blur"
          style={{ width: panelWidth }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-zinc-800/60 hover:bg-blue-500/60 transition-colors"
            onMouseDown={() => setResizing(true)}
          />
          <div className="flex items-start justify-between border-b border-zinc-800 p-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                Job Profile
              </div>
              <div className="text-lg font-semibold text-zinc-100">
                {panelJob.client}
              </div>
              <div className="text-xs text-zinc-500">{panelJob.title}</div>
            </div>
            <button
              onClick={closePanel}
              className="rounded-lg border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
            >
              Close
            </button>
          </div>

          <div className="h-[calc(100%-64px)] overflow-y-auto p-4 space-y-6">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                  Schedule
                </span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-400">
                  {panelJob.status}
                </span>
              </div>
              <div className="text-sm text-zinc-100">
                {panelStart
                  ? formatDisplayDate(toDateKey(panelStart))
                  : "No date set"}
              </div>
              <div className="text-xs text-zinc-500">
                {panelStart && panelEnd
                  ? `${formatTime(panelStart)} - ${formatTime(panelEnd)}`
                  : "Time not set"}
              </div>
              <div className="text-xs text-zinc-500">Team: {panelTeam}</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    panelJob.cleaningTeam && panelJob.cleaningTeam.length > 0
                      ? "bg-blue-500/20 text-blue-100"
                      : panelJob.email
                      ? "bg-emerald-500/20 text-emerald-100"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {panelJob.cleaningTeam && panelJob.cleaningTeam.length > 0
                    ? "Scheduled"
                    : panelJob.email
                    ? "Quoted"
                    : "New Lead"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    panelJob.paid
                      ? "bg-blue-500/20 text-blue-100"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {panelJob.paid ? "Paid" : "Unpaid"}
                </span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">
                  {panelJob.hours ? `${panelJob.hours} hrs` : "Hours TBD"}
                </span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">
                  ${panelJob.price || 0}
                </span>
              </div>
            </section>

            {!pendingMove && (
              <button
                onClick={() => openReschedule(panelJob)}
                className="w-full rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-500/20 transition-colors"
              >
                Reschedule Job
              </button>
            )}

            {pendingMove && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                    Reschedule
                  </span>
                  <span className="text-xs text-zinc-400">
                    {previewStart && previewEnd
                      ? `${formatTime(previewStart)} - ${formatTime(previewEnd)}`
                      : ""}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-zinc-500">
                    Date
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(event) => setTargetDate(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </label>
                  <label className="text-xs text-zinc-500">
                    Start time
                    <input
                      id="time-input"
                      type="time"
                      step={MIN_SLOT * 60}
                      value={targetTime}
                      onChange={(event) => setTargetTime(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-zinc-500">
                    Crew size
                    <input
                      type="number"
                      min={1}
                      value={crewSize}
                      onChange={(event) =>
                        handleCrewSizeChange(Number(event.target.value || 1))
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </label>
                  <label className="text-xs text-zinc-500">
                    Duration (hrs)
                    <input
                      type="number"
                      step={0.5}
                      min={0.5}
                      value={durationHours}
                      onChange={(event) =>
                        handleDurationChange(Number(event.target.value || 0))
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500">
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

                <label className="text-xs text-zinc-500">
                  Assigned team
                  <input
                    id="team-input"
                    type="text"
                    value={teamInput}
                    onChange={(event) => handleTeamInputChange(event.target.value)}
                    placeholder="Names separated by commas"
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </label>

                {conflicts.length > 0 && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="uppercase tracking-widest">
                        Conflicts
                      </span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => focusInput("time-input")}
                          className="rounded-full border border-amber-500/40 px-2 py-1 hover:bg-amber-500/20"
                        >
                          Adjust time
                        </button>
                        <button
                          type="button"
                          onClick={() => focusInput("team-input")}
                          className="rounded-full border border-amber-500/40 px-2 py-1 hover:bg-amber-500/20"
                        >
                          Reassign team
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotifyClient(true)}
                          className="rounded-full border border-amber-500/40 px-2 py-1 hover:bg-amber-500/20"
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
                        <span className="text-amber-200/70">
                          {formatTimeRange(conflict.job)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {downstreamJobs.length > 0 && shiftMinutes > 0 && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-400">
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
                        <label className="flex items-center gap-2 text-xs text-zinc-400">
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

                        <div className="space-y-1 text-xs text-zinc-500">
                          {shiftedDownstream.map((shift) => (
                            <div
                              key={shift.job.id}
                              className="flex items-center justify-between"
                            >
                              <span className="truncate">{shift.job.client}</span>
                              <span className="text-zinc-400">
                                {shift.newTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <label className="text-xs text-zinc-500">
                  Reschedule reason
                  <textarea
                    value={rescheduleReason}
                    onChange={(event) => setRescheduleReason(event.target.value)}
                    placeholder="Add a quick note for internal tracking"
                    className="mt-1 min-h-[70px] w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                      Client Notification
                    </span>
                    <label className="flex items-center gap-2 text-xs text-zinc-400">
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
                          : "border border-zinc-800 text-zinc-400"
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
                          : "border border-zinc-800 text-zinc-400"
                      }`}
                    >
                      Manual
                    </button>
                  </div>

                  <textarea
                    value={notifyMessage}
                    onChange={(event) => setNotifyMessage(event.target.value)}
                    disabled={!notifyClient}
                    className="min-h-[110px] w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50"
                  />
                </div>

                {saveError && (
                  <div className="text-xs text-rose-300">{saveError}</div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRescheduleConfirm}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Confirm reschedule"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingMove(null)}
                    className="rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-8">
          <div className="glass-card rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-200">
                  Schedule Cascade Detected
                </h2>
                <p className="text-sm text-zinc-500 mt-2">
                  This change will affect {cascadePreview.changes.length - 1} other job{cascadePreview.changes.length > 2 ? 's' : ''} on the same day
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCascadeModal(false);
                  setCascadePreview(null);
                }}
                className="text-zinc-600 hover:text-zinc-400 text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800/50"
              >
                ×
              </button>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/40 p-4">
              <h3 className="text-sm font-semibold text-blue-200 mb-2">What Changed</h3>
              <p className="text-sm text-zinc-300 whitespace-pre-line">{cascadePreview.summary}</p>
            </div>

            {/* Conflicts */}
            {cascadePreview.conflicts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-amber-400 uppercase tracking-wider">
                  ⚠️ {cascadePreview.conflicts.length} Conflict{cascadePreview.conflicts.length > 1 ? 's' : ''} Detected
                </h3>
                {cascadePreview.conflicts.map((conflict, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/40"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-amber-100">
                        {conflict.job.client}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-600/30 text-amber-200">
                        {conflict.severity}
                      </span>
                    </div>
                    <div className="text-sm text-amber-200/90">{conflict.reason}</div>
                  </div>
                ))}
                <div className="text-xs text-amber-300 bg-amber-500/5 rounded-lg p-3">
                  💡 These conflicts must be resolved before proceeding. Consider choosing a different time or manually adjusting the conflicting jobs.
                </div>
              </div>
            )}

            {/* Affected Jobs */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Affected Appointments ({cascadePreview.changes.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cascadePreview.changes.map((change, idx) => (
                  <div
                    key={change.job.id}
                    className={`rounded-xl p-4 ${
                      idx === 0
                        ? 'bg-blue-500/10 border border-blue-500/40'
                        : 'bg-zinc-800/30 border border-zinc-700/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-200">
                            {change.job.client}
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/40 text-blue-200">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500">{change.job.title}</div>
                        {change.deltaMinutes !== 0 && (
                          <div className="text-sm text-zinc-300">
                            {formatTime(change.originalStart)} → {formatTime(change.newStart)}
                            <span className={`ml-2 text-xs ${change.deltaMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              ({change.deltaMinutes > 0 ? '+' : ''}{change.deltaMinutes} min)
                            </span>
                          </div>
                        )}
                        {change.originalDuration !== change.newDuration && (
                          <div className="text-xs text-zinc-400">
                            Duration: {change.originalDuration}h → {change.newDuration}h
                          </div>
                        )}
                      </div>
                    </div>
                    {idx > 0 && (
                      <div className="mt-2 text-xs text-zinc-500 italic">
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
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                  Client Notifications ({cascadePreview.affectedClients.length} client{cascadePreview.affectedClients.length > 1 ? 's' : ''})
                </h3>
                <div className="text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-3">
                  After confirming these changes, you'll be able to send automated notifications to all affected clients explaining the schedule adjustment.
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t border-zinc-700">
              {cascadePreview.conflicts.length > 0 ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowCascadeModal(false);
                      setCascadePreview(null);
                    }}
                    className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
                  >
                    Cancel & Choose Different Time
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-xs text-zinc-500 px-2">
                    ✓ No conflicts detected. You can proceed with these automatic adjustments.
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowCascadeModal(false);
                        setCascadePreview(null);
                      }}
                      className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-8">
          <div className="glass-card rounded-3xl p-8 max-w-2xl w-full space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-200">
                  Scheduling Conflict Detected
                </h2>
                <p className="text-sm text-zinc-500 mt-2">
                  The selected time conflicts with existing appointments
                </p>
              </div>
              <button
                onClick={() => {
                  setShowConflictModal(false);
                  setConflictDetails(null);
                }}
                className="text-zinc-600 hover:text-zinc-400 text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800/50"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                Conflicts ({conflictDetails.conflicts.length})
              </h3>
              <div className="space-y-3">
                {conflictDetails.conflicts.map((conflict) => (
                  <div
                    key={conflict.job.id}
                    className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/40"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-amber-100">
                        {conflict.job.client}
                      </span>
                      <span className="text-xs text-amber-200">
                        {formatTimeRange(conflict.job)}
                      </span>
                    </div>
                    <div className="text-sm text-amber-200/80">
                      {conflict.reason}
                    </div>
                    <div className="text-xs text-amber-200/60 mt-1">
                      {conflict.job.title} • Team: {conflict.job.cleaningTeam.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <div className="text-xs text-zinc-500 px-2">
                ⚠️ Scheduling this job will create conflicts with the appointments shown above. You can either choose a different time or override the conflict.
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowConflictModal(false);
                    setConflictDetails(null);
                  }}
                  className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
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
