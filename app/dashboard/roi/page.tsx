import { getDashboardData, calculateTimeSaved } from "@/lib/google-sheets";

export default async function ROIPage() {
  const data = await getDashboardData();
  const timeSaved = calculateTimeSaved(data.jobs);

  const totalRevenue = data.jobs
    .filter(j => j.booked && j.paid)
    .reduce((sum, job) => sum + job.price, 0);
  const bookedJobs = data.jobs.filter(j => j.booked).length;
  const completedJobs = data.jobs.filter(j => j.status === 'completed').length;

  // $15 per booked job
  const osirisCost = bookedJobs * 15;
  const netGain = totalRevenue - osirisCost;
  const multiplier = osirisCost > 0 ? (netGain / osirisCost).toFixed(0) : 0;

  return (
    <div className="p-12 space-y-12">
      <div className="max-w-[1000px] mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-semibold neon-glow tracking-wide">
            Impact
          </h1>
          <p className="text-sm text-zinc-500 tracking-wide">
            What The Clean Machine generated for you
          </p>
        </div>

        {/* Main Financial Stack */}
        <div className="glass-card rounded-3xl p-12 md:p-16 space-y-12">
          {/* Total Revenue Generated */}
          <div className="text-center space-y-3">
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.2em]">
              Total Revenue Generated
            </div>
            <div className="text-5xl md:text-7xl font-bold text-zinc-200">
              ${totalRevenue.toLocaleString()}
            </div>
          </div>

          {/* Total System Cost */}
          <div className="text-center space-y-3">
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.2em]">
              The Clean Machine Cost ({bookedJobs} jobs x $15)
            </div>
            <div className="text-5xl md:text-7xl font-bold text-zinc-500">
              ${osirisCost.toLocaleString()}
            </div>
          </div>

          {/* Net Gain - Soft Emerald */}
          <div className="text-center space-y-3 pt-8 border-t border-zinc-800/30">
            <div className="text-[10px] font-medium text-emerald-400 uppercase tracking-[0.2em]">
              Net Gain
            </div>
            <div className="text-6xl md:text-8xl font-bold state-positive">
              +${netGain.toLocaleString()}
            </div>
          </div>

          {/* Bottom Message */}
          <div className="text-center pt-8">
            <p className="text-base text-zinc-500">
              The Clean Machine paid for itself{' '}
              <span className="text-2xl text-emerald-400 font-semibold">{multiplier}x</span>{' '}
              over.
            </p>
          </div>
        </div>

        {/* System Metrics - Minimal */}
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center space-y-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium">
              Jobs Automated
            </div>
            <div className="text-4xl md:text-5xl font-bold text-purple-400">
              {bookedJobs}
            </div>
          </div>

          <div className="text-center space-y-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium">
              Jobs Completed
            </div>
            <div className="text-4xl md:text-5xl font-bold text-purple-400">
              {completedJobs}
            </div>
          </div>

          <div className="text-center space-y-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium">
              Hours Reclaimed
            </div>
            <div className="text-4xl md:text-5xl font-bold text-purple-400">
              {timeSaved} <span className="text-2xl">hrs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
