import { getDashboardData } from "@/lib/google-sheets";

const stages = [
  { key: "new", title: "New Leads", tone: "text-sky-300" },
  { key: "booked", title: "Booked", tone: "text-purple-300" },
  { key: "paid", title: "Paid", tone: "text-emerald-300" },
  { key: "completed", title: "Completed", tone: "text-zinc-300" }
] as const;

export default async function PipelinePage() {
  const data = await getDashboardData();

  const stageJobs = {
    new: data.jobs.filter((job) => !job.booked),
    booked: data.jobs.filter((job) => job.booked && !job.paid),
    paid: data.jobs.filter((job) => job.paid && job.status !== "completed"),
    completed: data.jobs.filter((job) => job.status === "completed")
  };

  return (
    <div className="p-12 space-y-12">
      <div className="max-w-[1400px] mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-semibold neon-glow tracking-wide">
            Client Status
          </h1>
          <p className="text-sm text-zinc-500 tracking-wide">
            Live view of every client moving through your system
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-xs text-purple-200 uppercase tracking-[0.3em]">
              Client Journey
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 64 64"
              className="h-5 w-5 text-purple-300"
            >
              <path
                d="M46 6c5 0 9 4 9 9v4c0 4-3 7-7 7h-6V15c0-5 4-9 4-9zm-6 20h8c6 0 11-5 11-11v-4C59 5 54 0 48 0h-2C38 0 32 6 32 14v22l-8 8 6 6 8-8h10c2 0 4-2 4-4V26h-6v8h-8V26zm-18 6-4 4 12 12 4-4-12-12zm-8 8-8 8 12 12 8-8-12-12z"
                fill="currentColor"
              />
            </svg>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {stages.map((stage) => (
              <div
                key={stage.key}
                className="rounded-2xl border border-zinc-800/40 bg-zinc-900/40 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className={`text-sm font-semibold ${stage.tone}`}>
                    {stage.title}
                  </h2>
                  <span className="text-xs text-zinc-500">
                    {stageJobs[stage.key].length}
                  </span>
                </div>

                <div className="space-y-3">
                  {stageJobs[stage.key].length === 0 ? (
                    <div className="text-xs text-zinc-600">
                      No clients yet
                    </div>
                  ) : (
                    stageJobs[stage.key].map((job) => (
                      <div
                        key={job.id}
                        className="rounded-xl border border-zinc-800/40 bg-zinc-950/30 px-4 py-3"
                      >
                        <div className="text-sm font-medium text-zinc-200 truncate">
                          {job.client}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {job.title} -{" "}
                          {new Date(job.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric"
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
