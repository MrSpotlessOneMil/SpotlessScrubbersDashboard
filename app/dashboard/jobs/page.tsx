import { getDashboardData } from "@/lib/google-sheets";

export default async function JobsPage() {
  const data = await getDashboardData();
  const sortedJobs = [...data.jobs].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="p-12 space-y-12">
      <div className="max-w-[1200px] mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-light neon-glow tracking-wide">
            Activity
          </h1>
          <p className="text-sm text-zinc-600 tracking-wide">
            Everything handled by The Clean Machine
          </p>
        </div>

        {/* Jobs List - Card Based, Not Table */}
        {sortedJobs.length === 0 ? (
          <div className="glass-card rounded-3xl p-16 text-center">
            <p className="text-zinc-600">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedJobs.map((job) => (
              <div
                key={job.id}
                className="glass-card rounded-2xl p-8"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-baseline gap-4">
                      <h3 className="text-xl font-light text-zinc-200">
                        {job.client}
                      </h3>
                      <span className="text-xs text-zinc-600 uppercase tracking-wider">
                        {job.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-zinc-600">
                      <span>{formatDate(job.date)}</span>
                      <span>-</span>
                      <span className="capitalize">{job.status}</span>
                      <span>-</span>
                      <span>Team: {job.cleaningTeam.join(', ')}</span>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="text-2xl font-light text-purple-400">
                      ${job.price}
                    </div>
                    <div className="flex gap-2">
                      {job.booked && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-purple-400/10 text-purple-400 uppercase tracking-wider">
                          Booked
                        </span>
                      )}
                      {job.paid && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-purple-400/10 text-purple-400 uppercase tracking-wider">
                          Paid
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
