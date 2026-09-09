'use client';
import { useState } from 'react';
import { number, dayLabel, type Series } from '@/lib/dashboard-insights';
export function Empty({ text }: { text: string }) {
  return (
    <p className="my-5 rounded-xl border border-dashed bg-slate-50/50 p-5 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}
export function TrendChart({
  items,
  metric,
}: {
  items: Series[];
  metric: 'enrollments' | 'sessions' | 'events';
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((x) => x[metric]));
  const sum = items.reduce((n, x) => n + x[metric], 0);
  const width = 680,
    height = 205,
    left = 38,
    plot = width - left - 8;
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-baseline gap-2">
        <strong className="text-2xl font-semibold">
          {number(active !== null && items[active] ? items[active][metric] : sum)}
        </strong>
        <span className="text-xs text-slate-500">
          {active !== null && items[active] ? dayLabel(items[active].date) : 'total del período'}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height + 28}`}
        role="img"
        aria-label={`Tendencia diaria de ${metric === 'enrollments' ? 'solicitudes' : metric === 'sessions' ? 'sesiones' : 'eventos'}: ${sum} en el período`}
        className="w-full"
        onMouseLeave={() => setActive(null)}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={left}
              x2={width}
              y1={height - 16 - f * (height - 26)}
              y2={height - 16 - f * (height - 26)}
              stroke="#e2e8f0"
              strokeDasharray="4 5"
            />
            <text
              x={left - 9}
              y={height - 12 - f * (height - 26)}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
            >
              {number(Math.round(max * f))}
            </text>
          </g>
        ))}
        {items.map((item, i) => {
          const h = (item[metric] / max) * (height - 26),
            w = plot / items.length;
          return (
            <g
              key={item.date}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              tabIndex={0}
              aria-label={`${item.date}: ${item[metric]}`}
            >
              <title>
                {dayLabel(item.date)}: {item[metric]}
              </title>
              <rect
                x={left + i * w + w * 0.15}
                y={height - 16 - h}
                width={w * 0.7}
                height={h}
                rx={Math.min(3, w * 0.2)}
                fill={active === i ? '#0e7490' : '#1875ab'}
              />
              <rect x={left + i * w} y={8} width={w} height={height - 16} fill="transparent" />
            </g>
          );
        })}
        {items.length > 0 && (
          <>
            <text x={left} y={height + 11} fontSize="10" fill="#94a3b8">
              {dayLabel(items[0].date)}
            </text>
            <text x={width - 8} y={height + 11} textAnchor="end" fontSize="10" fill="#94a3b8">
              {dayLabel(items[items.length - 1].date)}
            </text>
          </>
        )}
      </svg>
      {sum === 0 && (
        <p className="text-center text-xs text-slate-500">
          Sin actividad registrada para esta serie.
        </p>
      )}
    </div>
  );
}
