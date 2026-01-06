"use client";

import { useEffect, useMemo, useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { MessageBubble } from "@/components/MessageBubble";
import { Call, CallerProfile, Job } from "@/lib/google-sheets";

type PipelineStage =
  | "New Lead"
  | "Quoted & Invoiced"
  | "Deposit Paid"
  | "Appointment Scheduled"
  | "Job Completed"
  | "Retargeting";

type ClientRecord = {
  phoneNumber: string;
  name: string;
  jobs: Job[];
  calls: Call[];
  messages: CallerProfile["messages"];
  stage: PipelineStage;
  lastActivity: string;
};

const stageOrder: PipelineStage[] = [
  "New Lead",
  "Quoted & Invoiced",
  "Deposit Paid",
  "Appointment Scheduled",
  "Job Completed",
  "Retargeting"
];

const stageAccent: Record<PipelineStage, string> = {
  "New Lead": "text-sky-200",
  "Quoted & Invoiced": "text-amber-200",
  "Deposit Paid": "text-emerald-200",
  "Appointment Scheduled": "text-indigo-200",
  "Job Completed": "text-zinc-200",
  "Retargeting": "text-rose-200"
};

function formatPhone(phone: string) {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
}

function toDate(value?: string) {
  return value ? new Date(value) : new Date(0);
}

function resolveStage(job?: Job): PipelineStage {
  if (!job) {
    return "New Lead";
  }
  if (job.status === "completed") {
    return "Job Completed";
  }
  if (job.status === "cancelled") {
    return "Retargeting";
  }
  if (job.paid) {
    return "Deposit Paid";
  }
  if (job.booked) {
    return "Appointment Scheduled";
  }
  if (job.invoiceSent || job.price > 0) {
    return "Quoted & Invoiced";
  }
  return "New Lead";
}

export default function PipelinePage() {
  const [profiles, setProfiles] = useState<CallerProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
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

  const clients = useMemo(() => {
    const map = new Map<string, ClientRecord>();

    profiles.forEach((profile) => {
      map.set(profile.phoneNumber, {
        phoneNumber: profile.phoneNumber,
        name: profile.callerName,
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
        jobs: [],
        calls: [],
        messages: [],
        stage: "New Lead",
        lastActivity: job.createdAt || job.date
      };
      entry.jobs.push(job);
      const latest = job.createdAt || job.date;
      if (toDate(latest) > toDate(entry.lastActivity)) {
        entry.lastActivity = latest;
      }
      map.set(job.phoneNumber, entry);
    });

    calls.forEach((call) => {
      const entry = map.get(call.phoneNumber) || {
        phoneNumber: call.phoneNumber,
        name: call.callerName,
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

    const list = Array.from(map.values()).map((client) => {
      const latestJob = [...client.jobs].sort(
        (a, b) => toDate(b.createdAt || b.date).getTime() - toDate(a.createdAt || a.date).getTime()
      )[0];
      return {
        ...client,
        stage: resolveStage(latestJob)
      };
    });

    return list.sort(
      (a, b) => toDate(b.lastActivity).getTime() - toDate(a.lastActivity).getTime()
    );
  }, [profiles, jobs, calls]);

  const pipeline = useMemo(() => {
    const grouped: Record<PipelineStage, ClientRecord[]> = {
      "New Lead": [],
      "Quoted & Invoiced": [],
      "Deposit Paid": [],
      "Appointment Scheduled": [],
      "Job Completed": [],
      "Retargeting": []
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
      const baseTime = job.createdAt || job.date;
      items.push({ time: baseTime, label: `Job created: ${job.title}` });
      if (job.booked) {
        items.push({ time: baseTime, label: "Appointment booked" });
      }
      if (job.paid) {
        items.push({ time: job.date, label: "Deposit received" });
      }
      if (job.status === "completed") {
        items.push({ time: job.date, label: "Job completed" });
      }
      if (job.status === "cancelled") {
        items.push({ time: job.date, label: "Moved to retargeting" });
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
  }, [selectedClient]);

  return (
    <div className="p-12 space-y-10">
      <div className="max-w-[1600px] mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-6xl font-semibold tracking-tight text-zinc-100">
            Pipeline Journey
          </h1>
          <p className="text-sm text-zinc-400">
            Every client, staged for operations and retention.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-6">
          {stageOrder.map((stage) => (
            <div
              key={stage}
              className="rounded-3xl border border-zinc-800/60 bg-zinc-950/60 p-4"
            >
              <div className="flex items-center justify-between">
                <div className={`text-xs uppercase tracking-[0.2em] ${stageAccent[stage]}`}>
                  {stage}
                </div>
                <span className="text-xs text-zinc-500">
                  {pipeline[stage].length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {pipeline[stage].length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-800/60 px-3 py-4 text-xs text-zinc-600">
                    No clients here yet
                  </div>
                ) : (
                  pipeline[stage].map((client) => {
                    const latestJob = [...client.jobs].sort(
                      (a, b) => toDate(b.createdAt || b.date).getTime() - toDate(a.createdAt || a.date).getTime()
                    )[0];

                    return (
                      <button
                        key={`${stage}-${client.phoneNumber}`}
                        onClick={() => setSelectedClient(client)}
                        className="w-full rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-4 text-left transition hover:border-zinc-600"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-semibold text-zinc-100">
                              {client.name}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">
                              {formatPhone(client.phoneNumber)}
                            </div>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                            {stage}
                          </span>
                        </div>
                        {latestJob && (
                          <div className="mt-3 text-xs text-zinc-400">
                            {latestJob.title} - {new Date(latestJob.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric"
                            })}
                          </div>
                        )}
                        <div className="mt-3 text-[10px] uppercase tracking-wider text-zinc-500">
                          Last activity {new Date(client.lastActivity).toLocaleDateString("en-US", {
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
                            {new Date(job.date).toLocaleDateString("en-US", {
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
