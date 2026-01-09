interface ROIFooterProps {
  revenue: number;
  laborCost: number;
  osirisCost: number;
}

export function ROIFooter({ revenue, laborCost, osirisCost }: ROIFooterProps) {
  const netGain = revenue - laborCost - osirisCost;
  const multiplier = osirisCost > 0 ? (netGain / osirisCost).toFixed(1) : 0;

  return (
    <div className="glass-card rounded-3xl p-12">
      <div className="max-w-2xl mx-auto space-y-12">
        {/* Total Revenue */}
        <div className="text-center space-y-2">
          <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-[0.2em]">
            Total Revenue Generated
          </div>
          <div className="text-6xl font-light text-zinc-300">
            ${revenue.toLocaleString()}
          </div>
        </div>

        {/* Total System Cost */}
        <div className="text-center space-y-2">
          <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-[0.2em]">
            Total Cost of The Clean Machine
          </div>
          <div className="text-6xl font-light text-zinc-500">
            ${osirisCost.toLocaleString()}
          </div>
        </div>

        {/* Net Gain */}
        <div className="text-center space-y-2">
          <div className="text-[10px] font-medium text-purple-400 uppercase tracking-[0.2em]">
            Net Gain
          </div>
          <div className="text-7xl font-light state-positive">
            +${netGain.toLocaleString()}
          </div>
        </div>

        {/* Bottom Message */}
        <div className="text-center pt-8 border-t border-zinc-800/50">
          <p className="text-sm text-zinc-500">
            The Clean Machine paid for itself <span className="text-purple-400 font-medium">{multiplier}x</span> over.
          </p>
        </div>
      </div>
    </div>
  );
}
