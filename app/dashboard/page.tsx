import { getDashboardData, calculateTimeSaved } from "@/lib/google-sheets";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const timeSaved = calculateTimeSaved(data.jobs);

  // Executive Metrics
  const totalRevenue = data.jobs
    .filter(j => j.booked && j.paid)
    .reduce((sum, job) => sum + job.price, 0);
  const bookedJobs = data.jobs.filter(j => j.booked).length;
  const osirisCost = bookedJobs * 15; // $15 per booked job
  const netProfit = totalRevenue - osirisCost;

  const activityItems = [
    ...data.jobs.map((job) => ({
      id: `job-${job.id}`,
      type: "New Job",
      client: job.client,
      summary: job.title,
      time: job.createdAt || job.date,
      meta: `Team: ${job.cleaningTeam.length ? job.cleaningTeam.join(", ") : "Unassigned"}`
    })),
    ...data.jobs
      .filter((job) => job.status !== "scheduled")
      .map((job) => ({
        id: `status-${job.id}`,
        type: "Status Change",
        client: job.client,
        summary: `${job.title} - ${job.status}`,
        time: job.date,
        meta: job.paid ? "Payment confirmed" : "Status updated"
      })),
    ...data.calls.map((call) => ({
      id: `call-${call.id}`,
      type: "New Call",
      client: call.callerName,
      summary: call.outcome ? `Outcome: ${call.outcome}` : "Call completed",
      time: call.date,
      meta: `Duration: ${Math.round(call.durationSeconds / 60)} min`
    })),
    ...data.profiles.flatMap((profile) =>
      profile.messages.map((message, index) => ({
        id: `msg-${profile.phoneNumber}-${index}`,
        type: message.content.toLowerCase().includes("rescheduled")
          ? "Reschedule"
          : message.role === "client"
          ? "Message Received"
          : "Message Sent",
        client: profile.callerName,
        summary:
          message.content.length > 72
            ? `${message.content.slice(0, 72)}...`
            : message.content,
        time: message.timestamp,
        meta: message.role === "client" ? "Client message" : "OSIRIS response"
      }))
    )
  ];

  const recentActivity = activityItems
    .filter((item) => item.time)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);

  return (
    <div className="p-12 space-y-12">
      <div className="max-w-[1400px] mx-auto space-y-12">
        {/* HERO */}
        <div className="text-center space-y-8 py-8">
          <h1 className="text-8xl font-semibold neon-glow tracking-wide">
            OSIRIS
          </h1>
          <div className="flex items-center justify-center">
            <div className="px-4 py-1.5 rounded-full border border-purple-400/20">
              <span className="text-[10px] font-medium text-purple-400 uppercase tracking-[0.2em]">
                {data.isLiveData ? "Live System" : "Demo Mode"}
              </span>
            </div>
          </div>
        </div>

        {/* EXECUTIVE METRICS - 4 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Booked Jobs */}
          <div className="glass-card rounded-3xl p-6 text-center space-y-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium">
              Booked Jobs
            </div>
            <div className="text-4xl md:text-5xl font-bold neon-glow-subtle">
              {bookedJobs}
            </div>
          </div>

          {/* Calls Answered */}
          <div className="glass-card rounded-3xl p-6 text-center space-y-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium">
              Calls Answered
            </div>
            <div className="text-4xl md:text-5xl font-bold neon-glow-subtle">
              {data.callsAnswered}
            </div>
          </div>

          {/* Hours Saved */}
          <div className="glass-card rounded-3xl p-6 text-center space-y-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium">
              Hours Saved
            </div>
            <div className="text-4xl md:text-5xl font-bold neon-glow-subtle">
              {timeSaved} <span className="text-2xl">hrs</span>
            </div>
          </div>

          {/* Net Profit */}
          <div className="glass-card rounded-3xl p-6 text-center space-y-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium">
              Net Profit
            </div>
            <div className="text-4xl md:text-5xl font-bold state-positive">
              ${netProfit.toLocaleString()}
            </div>
          </div>
        </div>

        {/* RECENT ACTIVITY SNAPSHOT */}
        <div className="glass-card rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.2em]">
              Recent Activity
            </h2>
          </div>

          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="status-indicator rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] px-2 py-1 rounded-full border border-zinc-700 text-zinc-400 uppercase tracking-wider">
                        {item.type}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {new Date(item.time).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <div className="text-base font-medium text-zinc-200">
                      {item.client}
                    </div>
                    <div className="text-sm text-zinc-400">{item.summary}</div>
                    <div className="text-xs text-zinc-600">{item.meta}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-zinc-600">
              Powered by OSIRIS AI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}




