import { formatCurrency, formatCurrencyShort } from '../types';

interface Props {
  value: number;
  meta70: number;
  meta80: number;
  meta90: number;
  meta100: number;
}

export function SpaceProgress({ value, meta70, meta80, meta90, meta100 }: Props) {
  const progress = meta100 > 0 ? Math.min(value / meta100, 1.05) : 0;
  const pct = (progress * 100).toFixed(1);

  // Rocket position: 5% to 92% of the width
  const rocketX = 50 + progress * 850;

  // Milestone positions
  const milestones = [
    { label: '70%', value: meta70, x: 50 + (meta70 / meta100) * 850, color: '#ef4444' },
    { label: '80%', value: meta80, x: 50 + (meta80 / meta100) * 850, color: '#eab308' },
    { label: '90%', value: meta90, x: 50 + (meta90 / meta100) * 850, color: '#22c55e' },
    { label: '100%', value: meta100, x: 50 + (meta100 / meta100) * 850, color: '#15803d' },
  ];

  // Stars
  const stars = Array.from({ length: 40 }, (_, i) => ({
    x: 20 + (i * 97) % 960,
    y: 10 + (i * 53) % 170,
    r: 0.5 + (i % 3) * 0.5,
    opacity: 0.3 + (i % 4) * 0.2,
  }));

  return (
    <div className="card-glass p-4 rounded-xl">
      <h3 className="text-base font-semibold text-foreground mb-4">Progresso Anual</h3>
      <svg viewBox="0 0 1000 200" className="w-full" style={{ maxHeight: '220px' }}>
        {/* Background - space */}
        <defs>
          <linearGradient id="spaceBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(240, 30%, 8%)" />
            <stop offset="100%" stopColor="hsl(260, 40%, 12%)" />
          </linearGradient>
          <radialGradient id="earthGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="70%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </radialGradient>
          <radialGradient id="moonGlow" cx="0.4" cy="0.4" r="0.5">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="70%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="1000" height="200" fill="url(#spaceBg)" rx="12" />

        {/* Stars */}
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.opacity} />
        ))}

        {/* Trajectory line (dashed) */}
        <line x1="70" y1="120" x2="930" y2="120" stroke="hsl(260, 30%, 25%)" strokeDasharray="4 6" strokeWidth="1" />

        {/* Earth (start) */}
        <circle cx="50" cy="120" r="28" fill="url(#earthGlow)" />
        <ellipse cx="45" cy="112" rx="8" ry="5" fill="#22c55e" opacity="0.7" />
        <ellipse cx="58" cy="125" rx="6" ry="4" fill="#22c55e" opacity="0.6" />
        <text x="50" y="162" textAnchor="middle" fill="hsl(240, 5%, 50%)" fontSize="9">R$ 0</text>

        {/* Milestone planets */}
        {milestones.map((m, i) => {
          const reached = value >= m.value;
          const planetR = 10 + i * 3;
          return (
            <g key={i}>
              <circle cx={m.x} cy="120" r={planetR} fill={reached ? m.color : 'hsl(260, 20%, 20%)'} opacity={reached ? 0.9 : 0.4} />
              {reached && <circle cx={m.x} cy="120" r={planetR + 3} fill="none" stroke={m.color} strokeWidth="1" opacity="0.3" />}
              <text x={m.x} y="120 " textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" dy="3">
                {m.label}
              </text>
              <text x={m.x} y={120 + planetR + 14} textAnchor="middle" fill="hsl(240, 5%, 50%)" fontSize="8">
                {formatCurrencyShort(m.value)}
              </text>
            </g>
          );
        })}

        {/* Moon (final target) */}
        <circle cx="940" cy="120" r="22" fill="url(#moonGlow)" />
        <circle cx="933" cy="114" r="3" fill="#d97706" opacity="0.5" />
        <circle cx="945" cy="125" r="2" fill="#d97706" opacity="0.4" />
        {/* Flag on moon */}
        <line x1="940" y1="98" x2="940" y2="108" stroke="white" strokeWidth="1.5" />
        <polygon points="940,98 955,102 940,106" fill="#ef4444" />
        <text x="948" y="93" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">Meta</text>

        {/* Rocket */}
        <g transform={`translate(${rocketX}, 100)`}>
          {/* Flame */}
          <ellipse cx="0" cy="22" rx="4" ry="8" fill="#f59e0b" opacity="0.8">
            <animate attributeName="ry" values="8;10;7;9;8" dur="0.5s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="0" cy="22" rx="2" ry="5" fill="#ef4444" opacity="0.9">
            <animate attributeName="ry" values="5;7;4;6;5" dur="0.4s" repeatCount="indefinite" />
          </ellipse>
          {/* Body */}
          <rect x="-6" y="-2" width="12" height="20" rx="3" fill="white" />
          <rect x="-5" y="2" width="10" height="3" rx="1" fill="#ef4444" />
          {/* Nose */}
          <path d="M-6,-2 L0,-14 L6,-2" fill="white" />
          <circle cx="0" cy="8" r="3" fill="#3b82f6" />
          <circle cx="0" cy="8" r="1.5" fill="white" />
          {/* Wings */}
          <path d="M-6,14 L-12,22 L-6,18" fill="hsl(240, 5%, 70%)" />
          <path d="M6,14 L12,22 L6,18" fill="hsl(240, 5%, 70%)" />
        </g>

        {/* Astronaut (small, floating) */}
        <g transform={`translate(${Math.min(rocketX + 40, 900)}, 85)`}>
          <circle cx="0" cy="0" r="5" fill="white" />
          <circle cx="0" cy="-1" r="3.5" fill="#1e40af" opacity="0.8" />
          <rect x="-4" y="5" width="8" height="7" rx="2" fill="white" />
          <line x1="-4" y1="8" x2="-8" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4" y1="8" x2="8" y2="5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Progress label (above rocket) */}
        <rect x={rocketX - 30} y="58" width="60" height="24" rx="6" fill="hsl(260, 30%, 15%)" stroke="hsl(260, 20%, 25%)" />
        <text x={rocketX} y="74" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">{pct}%</text>
      </svg>
    </div>
  );
}
