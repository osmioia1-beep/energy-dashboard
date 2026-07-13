export interface PowerCardProps {
  label: string;
  value: number | null | undefined;
  unit: string;
  color: string;
  icon?: React.ReactNode;
  trend?: number;
}

export function PowerCard({ label, value, unit, color, icon, trend }: PowerCardProps) {
  const formattedValue = value !== null && value !== undefined
    ? value.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : '—';

  const trendColor = trend !== undefined && trend >= 0 ? 'var(--green-600)' : 'var(--red-600)';
  const trendIcon = trend !== undefined && trend >= 0 ? '▲' : '▼';

  return (
    <div className="bg-secondary rounded-xl p-5 shadow-card border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-secondary">{label}</span>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold" style={{ color: color }}>{formattedValue}</span>
        <span className="text-secondary">{unit}</span>
      </div>
      {trend !== undefined && (
        <div className="mt-2 text-sm flex items-center gap-1" style={{ color: trendColor }}>
          <span>{trendIcon} {Math.abs(trend).toFixed(1)}%</span>
          <span className="text-secondary">vs anterior</span>
        </div>
      )}
    </div>
  );
}