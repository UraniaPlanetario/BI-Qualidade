interface GaugeChartProps {
  value: number;
  meta70: number;
  meta80: number;
  meta90: number;
  meta100: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function formatShort(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

export function GaugeChart({ value, meta70, meta80, meta90, meta100 }: GaugeChartProps) {
  const cx = 150;
  const cy = 150;
  const r = 120;
  const strokeWidth = 28;

  // Map value ranges to angles (180 = left, 0 = right)
  const zones = [
    { from: 0, to: meta70, color: 'hsl(0, 72%, 51%)', label: '0' },
    { from: meta70, to: meta80, color: 'hsl(45, 93%, 47%)', label: '70%' },
    { from: meta80, to: meta90, color: 'hsl(142, 60%, 50%)', label: '80%' },
    { from: meta90, to: meta100, color: 'hsl(142, 71%, 30%)', label: '90%' },
  ];

  const maxVal = meta100;

  function valueToAngle(v: number): number {
    const clamped = Math.max(0, Math.min(v, maxVal));
    return 180 - (clamped / maxVal) * 180;
  }

  const needleAngle = valueToAngle(value);
  const needleTip = polarToCartesian(cx, cy, r - strokeWidth / 2 - 8, needleAngle);
  const pct = maxVal > 0 ? ((value / maxVal) * 100).toFixed(1) : '0.0';

  return (
    <div className="card-glass p-4 rounded-xl text-center">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Progresso Anual</h3>
      <svg viewBox="0 0 300 180" className="w-full max-w-md mx-auto">
        {/* Arcs for each zone */}
        {zones.map((zone, i) => {
          const startAngle = valueToAngle(zone.to);
          const endAngle = valueToAngle(zone.from);
          if (startAngle >= endAngle) return null;
          return (
            <path
              key={i}
              d={describeArc(cx, cy, r, startAngle, endAngle)}
              fill="none"
              stroke={zone.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
            />
          );
        })}

        {/* Boundary labels */}
        {[
          { val: 0, label: formatShort(0) },
          { val: meta70, label: '70%' },
          { val: meta80, label: '80%' },
          { val: meta90, label: '90%' },
          { val: meta100, label: '100%' },
        ].map(({ val, label }, i) => {
          const angle = valueToAngle(val);
          const pos = polarToCartesian(cx, cy, r + 18, angle);
          return (
            <text
              key={i}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="hsl(240, 5%, 65%)"
              fontSize={10}
            >
              {label}
            </text>
          );
        })}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="hsl(240, 5%, 90%)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={5} fill="hsl(240, 5%, 90%)" />

        {/* Value */}
        <text x={cx} y={cy + 24} textAnchor="middle" fill="hsl(240, 5%, 96%)" fontSize={16} fontWeight="bold">
          {formatShort(value)}
        </text>
        <text x={cx} y={cy + 40} textAnchor="middle" fill="hsl(240, 5%, 65%)" fontSize={12}>
          {pct}% da meta
        </text>
      </svg>
    </div>
  );
}
