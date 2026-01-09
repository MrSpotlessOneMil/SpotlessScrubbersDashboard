export function SystemStatus() {
  const systems = [
    "Lead Intake",
    "Booking Engine",
    "Follow-ups",
    "Scheduling",
    "Invoicing",
  ];

  return (
    <div className="glass-card rounded-3xl p-8">
      <h2 className="text-[10px] font-medium text-zinc-600 mb-6 uppercase tracking-[0.2em]">
        The Clean Machine System Status
      </h2>
      <div className="space-y-3">
        {systems.map((system) => (
          <div key={system} className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 subtle-pulse" />
            <span className="text-sm text-zinc-400">{system}</span>
            <span className="text-xs text-purple-400 ml-auto">Active</span>
          </div>
        ))}
      </div>
    </div>
  );
}
