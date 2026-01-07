"use client";

import { useEffect, useMemo, useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { MessageBubble } from "@/components/MessageBubble";
import { Call, CallerProfile, Job } from "@/lib/google-sheets";

type PipelineStage =
  | "New Lead"
  | "Quoted & Invoiced"
  | "Scheduled / Underway"
  | "Job Completed";

type ClientRecord = {
  phoneNumber: string;
  name: string;
  email?: string;
  jobs: Job[];
  calls: Call[];
  messages: CallerProfile["messages"];
  stage: PipelineStage;
  lastActivity: string;
};

const stageOrder: PipelineStage[] = [
  "New Lead",
  "Quoted & Invoiced",
  "Scheduled / Underway",
  "Job Completed"
];

const stageColors: Record<PipelineStage, string> = {
  "New Lead": "bg-blue-50 border-blue-200 text-blue-700",
  "Quoted & Invoiced": "bg-amber-50 border-amber-200 text-amber-700",
  "Scheduled / Underway": "bg-emerald-50 border-emerald-200 text-emerald-700",
  "Job Completed": "bg-slate-100 border-slate-300 text-slate-700"
};

function formatPhone(phone: string) {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
}

function toDate(value?: string) {
  return value ? new Date(value) : new Date(0);
}

function resolveJobStart(job: Job) {
  const value = job.scheduledAt || job.date;
  return value ? new Date(value) : null;
}

function resolveJobEnd(job: Job) {
  const start = resolveJobStart(job);
  if (!start || typeof job.hours !== "number") {
    return null;
  }
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + Math.round(job.hours * 60));
  return end;
}

function isJobCompleted(job: Job, now: Date) {
  const end = resolveJobEnd(job);
  return !!end && now >= end;
}

function resolveStage(client: ClientRecord, now: Date): PipelineStage {
  let stageIndex = 0;

  if (client.calls.length > 0 || client.jobs.length > 0) {
    stageIndex = Math.max(stageIndex, 0);
  }

  const hasEmail = Boolean(client.email && client.email.trim());
  const hasBooked = client.jobs.some((job) => job.booked);
  if (hasEmail || hasBooked) {
    stageIndex = Math.max(stageIndex, 1);
  }

  const hasTeamAssigned = client.jobs.some(
    (job) => job.cleaningTeam.length > 0
  );
  if (hasTeamAssigned) {
    stageIndex = Math.max(stageIndex, 2);
  }

  const hasCompleted = client.jobs.some((job) => isJobCompleted(job, now));
  if (hasCompleted) {
    stageIndex = Math.max(stageIndex, 3);
  }

  return stageOrder[stageIndex];
}

export default function PipelinePage() {
  const [profiles, setProfiles] = useState<CallerProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [stageMemory, setStageMemory] = useState<Record<string, PipelineStage>>({});
  const [panelWidth, setPanelWidth] = useState(420);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      setProfiles(data.profiles);
      setJobs(data.jobs);
      setCalls(data.calls);
    }
    fetchData();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

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

  const { clients, computedStages } = useMemo(() => {
    const map = new Map<string, ClientRecord>();

    profiles.forEach((profile) => {
      map.set(profile.phoneNumber, {
        phoneNumber: profile.phoneNumber,
        name: profile.callerName,
        email: undefined,
        jobs: [],
        calls: [],
        messages: profile.messages,
        stage: "New Lead",
        lastActivity: profile.lastCallDate
      });
    });

    jobs.forEach((job) => {
      const entry = map.get(job.phoneNumber) || {
        phoneNumber: job.phoneNumber,
        name: job.client,
        email: job.email,
        jobs: [],
        calls: [],
        messages: [],
        stage: "New Lead",
        lastActivity: job.createdAt || job.scheduledAt || job.date
      };
      if (job.email && !entry.email) {
        entry.email = job.email;
      }
      entry.jobs.push(job);
      const latest = job.createdAt || job.scheduledAt || job.date;
      if (toDate(latest) > toDate(entry.lastActivity)) {
        entry.lastActivity = latest;
      }
      map.set(job.phoneNumber, entry);
    });

    calls.forEach((call) => {
      const entry = map.get(call.phoneNumber) || {
        phoneNumber: call.phoneNumber,
        name: call.callerName,
        email: undefined,
        jobs: [],
        calls: [],
        messages: [],
        stage: "New Lead",
        lastActivity: call.date
      };
      entry.calls.push(call);
      if (toDate(call.date) > toDate(entry.lastActivity)) {
        entry.lastActivity = call.date;
      }
      map.set(call.phoneNumber, entry);
    });

    const computedStageMap = new Map<string, PipelineStage>();
    const list = Array.from(map.values()).map((client) => {
      const computedStage = resolveStage(client, now);
      computedStageMap.set(client.phoneNumber, computedStage);
      const previousStage = stageMemory[client.phoneNumber];
      const nextStage = previousStage
        ? stageOrder[
            Math.max(
              stageOrder.indexOf(previousStage),
              stageOrder.indexOf(computedStage)
            )
          ]
        : computedStage;
      return {
        ...client,
        stage: nextStage
      };
    });

    return {
      clients: list.sort(
        (a, b) =>
          toDate(b.lastActivity).getTime() - toDate(a.lastActivity).getTime()
      ),
      computedStages: computedStageMap
    };
  }, [profiles, jobs, calls, now, stageMemory]);

  useEffect(() => {
    if (!computedStages.size) {
      return;
    }

    setStageMemory((prev) => {
      const next = { ...prev };
      let hasChanges = false;
      computedStages.forEach((stage, phone) => {
        const previousStage = prev[phone];
        if (
          !previousStage ||
          stageOrder.indexOf(stage) > stageOrder.indexOf(previousStage)
        ) {
          next[phone] = stage;
          hasChanges = true;
        }
      });
      // Only return new object if there were actual changes
      return hasChanges ? next : prev;
    });
  }, [computedStages]);

  const pipeline = useMemo(() => {
    const grouped: Record<PipelineStage, ClientRecord[]> = {
      "New Lead": [],
      "Quoted & Invoiced": [],
      "Scheduled / Underway": [],
      "Job Completed": []
    };

    clients.forEach((client) => {
      grouped[client.stage].push(client);
    });

    stageOrder.forEach((stage) => {
      grouped[stage] = grouped[stage].sort(
        (a, b) => toDate(b.lastActivity).getTime() - toDate(a.lastActivity).getTime()
      );
    });

    return grouped;
  }, [clients]);

  const selectedTimeline = useMemo(() => {
    if (!selectedClient) {
      return [] as { time: string; label: string }[];
    }

    const items: { time: string; label: string }[] = [];

    selectedClient.jobs.forEach((job) => {
      const baseTime = job.createdAt || job.scheduledAt || job.date;
      items.push({ time: baseTime, label: `Job created: ${job.title}` });
      if (job.booked || (selectedClient.email && selectedClient.email.trim())) {
        items.push({ time: baseTime, label: "Quoted & invoiced" });
      }
      if (job.cleaningTeam.length > 0) {
        items.push({ time: baseTime, label: "Scheduled / underway" });
      }
      if (isJobCompleted(job, now)) {
        const completedAt = resolveJobEnd(job);
        items.push({
          time: completedAt ? completedAt.toISOString() : job.scheduledAt || job.date,
          label: "Job completed"
        });
      }
    });

    selectedClient.messages
      .filter((msg) => msg.content.toLowerCase().includes("rescheduled"))
      .forEach((msg) => {
        items.push({ time: msg.timestamp, label: "Job rescheduled" });
      });

    return items
      .filter((item) => item.time)
      .sort((a, b) => toDate(b.time).getTime() - toDate(a.time).getTime());
  }, [selectedClient, now]);

  return (
    <div className="min-h-screen bg-white p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="pb-4 border-b border-slate-200">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Client Status
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Track every client from first contact to job completion • {clients.length} total clients
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {stageOrder.map((stage) => (
            <div
              key={stage}
              className="card-clean"
            >
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`text-xs font-bold uppercase tracking-wide text-slate-700`}>
                    {stage}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stageColors[stage]}`}>
                    {pipeline[stage].length}
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {pipeline[stage].length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">
                    No clients in this stage
                  </div>
                ) : (
                    pipeline[stage].map((client) => {
                    const latestJob = [...client.jobs].sort(
                      (a, b) =>
                        toDate(b.createdAt || b.scheduledAt || b.date).getTime() -
                        toDate(a.createdAt || a.scheduledAt || a.date).getTime()
                    )[0];

                    return (
                      <button
                        key={`${stage}-${client.phoneNumber}`}
                        onClick={() => setSelectedClient(client)}
                        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-blue-300 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              {client.name}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {formatPhone(client.phoneNumber)}
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${stageColors[stage]}`}>
                            {client.jobs.length} {client.jobs.length === 1 ? 'job' : 'jobs'}
                          </span>
                        </div>
                        {latestJob && (
                          <div className="text-xs text-slate-600 py-1.5 border-t border-slate-100">
                            <span className="font-medium">{latestJob.title}</span> • {new Date(
                              latestJob.scheduledAt || latestJob.date
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric"
                            })}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 mt-1">
                          Last activity: {new Date(client.lastActivity).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit"
                          })}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`fixed inset-y-0 right-0 z-40 transform transition-transform duration-300 ${
          selectedClient ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: panelWidth }}
      >
        <div className="h-full border-l border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur">
          <div
            className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-zinc-800/60"
            onMouseDown={() => setResizing(true)}
          />
          {selectedClient && (
            <div className="flex h-full flex-col">
              <div className="border-b border-zinc-800 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xl font-semibold text-zinc-100">
                      {selectedClient.name}
                    </div>
                    <div className="text-sm text-zinc-500 mt-1">
                      {formatPhone(selectedClient.phoneNumber)}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="text-zinc-500 hover:text-zinc-200"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Stage: {selectedClient.stage}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-8">
                <section className="pt-6">
                  <h3 className="text-xs uppercase tracking-[0.2em] text-zinc-500">Calls</h3>
                  <div className="mt-3 space-y-3">
                    {selectedClient.calls.length === 0 ? (
                      <div className="text-xs text-zinc-600">No calls yet.</div>
                    ) : (
                      selectedClient.calls.map((call) => (
                        <div key={call.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                          <div className="flex items-center justify-between text-xs text-zinc-400">
                            <span>
                              {new Date(call.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit"
                              })}
                            </span>
                            <span>{Math.round(call.durationSeconds / 60)} min</span>
                          </div>
                          {call.audioUrl && (
                            <div className="mt-3">
                              <AudioPlayer audioUrl={call.audioUrl} duration={call.durationSeconds} />
                            </div>
                          )}
                          {call.outcome && (
                            <div className="mt-2 text-[10px] uppercase tracking-wider text-zinc-500">
                              Outcome: {call.outcome}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-zinc-500">Messages</h3>
                  <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 max-h-96 overflow-y-auto">
                    {selectedClient.messages.length === 0 ? (
                      <div className="text-xs text-zinc-600">No messages yet.</div>
                    ) : (
                      selectedClient.messages.map((message, idx) => (
                        <MessageBubble
                          key={`${message.timestamp}-${idx}`}
                          role={message.role}
                          content={message.content}
                          timestamp={message.timestamp}
                        />
                      ))
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-zinc-500">Jobs</h3>
                  <div className="mt-3 space-y-3">
                    {selectedClient.jobs.length === 0 ? (
                      <div className="text-xs text-zinc-600">No jobs yet.</div>
                    ) : (
                      selectedClient.jobs.map((job) => (
                        <div key={job.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                          <div className="text-sm text-zinc-100 font-semibold">
                            {job.title}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {new Date(job.scheduledAt || job.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit"
                            })}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-2">
                            Status: {job.status}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-zinc-500">Status Timeline</h3>
                  <div className="mt-3 space-y-3">
                    {selectedTimeline.length === 0 ? (
                      <div className="text-xs text-zinc-600">No status history yet.</div>
                    ) : (
                      selectedTimeline.map((item, idx) => (
                        <div key={`${item.time}-${idx}`} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                          <div className="text-xs text-zinc-500">
                            {new Date(item.time).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit"
                            })}
                          </div>
                          <div className="text-sm text-zinc-100 mt-1">{item.label}</div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedClient && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
          onClick={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
}
