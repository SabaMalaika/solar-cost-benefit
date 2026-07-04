import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// Exact data from excel.xlsx
const EXCEL_DATA = [
  { year: 1,  Solar: 587.1,  Gas: 490,  Coal: 820  },
  { year: 2,  Solar: 880.6,  Gas: 980,  Coal: 1640 },
  { year: 3,  Solar: 1076.3, Gas: 1470, Coal: 2460 },
  { year: 5,  Solar: 1193.7, Gas: 1960, Coal: 3280 },
  { year: 10, Solar: 1252.4, Gas: 2450, Coal: 4100 },
  { year: 15, Solar: 1291.5, Gas: 2940, Coal: 4920 },
  { year: 20, Solar: 1320.9, Gas: 3430, Coal: 5740 },
  { year: 25, Solar: 1344.4, Gas: 3920, Coal: 6560 },
  { year: 30, Solar: 1364.0, Gas: 4410, Coal: 7380 },
];

function lerp(a, b, t) { return a + (b - a) * t; }

function interpolateAt(year) {
  const lo = EXCEL_DATA.filter(d => d.year <= year).slice(-1)[0];
  const hi = EXCEL_DATA.filter(d => d.year >= year)[0];
  if (!lo) return hi;
  if (!hi) return lo;
  if (lo.year === hi.year) return lo;
  const t = (year - lo.year) / (hi.year - lo.year);
  return {
    year,
    Solar: Math.round(lerp(lo.Solar, hi.Solar, t) * 10) / 10,
    Gas:   Math.round(lerp(lo.Gas,   hi.Gas,   t) * 10) / 10,
    Coal:  Math.round(lerp(lo.Coal,  hi.Coal,  t) * 10) / 10,
  };
}

// All 30 years pre-computed via linear interpolation
const ALL_DATA = Array.from({ length: 30 }, (_, i) => interpolateAt(i + 1));

// Static axes
const X_DOMAIN = [0, 8000];
const X_TICKS  = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];
const Y_TICKS  = [1, 5, 10, 15, 20, 25, 30];

const fmtX = v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1a1f2e', borderRadius: 12, padding: '10px 16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      fontFamily: 'sans-serif', fontSize: 13, color: '#fff', minWidth: 190,
    }}>
      <div style={{ marginBottom: 6, opacity: 0.55, fontSize: 11, letterSpacing: 0.5 }}>
        YEAR {label}
      </div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 3 }}>
          <span style={{ color: p.color }}>{p.dataKey}</span>
          <span style={{ fontWeight: 600 }}>{p.value.toLocaleString()} g/kWh</span>
        </div>
      ))}
    </div>
  );
};

const CustomLegend = ({ payload }) => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 14, fontFamily: 'sans-serif', fontSize: 13 }}>
    {payload.map(p => (
      <div key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 3, borderRadius: 2, background: p.color }} />
        <span style={{ color: '#444' }}>{p.value}</span>
      </div>
    ))}
  </div>
);

export default function ManufacturingChart({ onBack }) {
  const [sliderYear, setSliderYear] = useState(5);

  const visibleData = ALL_DATA.filter(d => d.year <= sliderYear);

  return (
    <div style={{
      background: '#fff', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 32px', fontFamily: 'sans-serif', boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 880 }}>

        {onBack && (
          <button onClick={onBack} style={{
            background: 'none', border: '1px solid #e0e0e0', borderRadius: 20,
            padding: '6px 16px', fontSize: 12, color: '#888', cursor: 'pointer',
            fontFamily: 'sans-serif', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ← Back to field
          </button>
        )}

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.2, color: '#999', textTransform: 'uppercase', marginBottom: 6 }}>
            Manufacturing footprint
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111', lineHeight: 1.3 }}>
            Cumulative CO₂e per kWh — Solar vs Fossil Fuels
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#777', lineHeight: 1.6 }}>
            Solar's upfront carbon is a one-time cost. Gas and coal keep accumulating.
          </p>
        </div>

        {/* Chart — Y = years, X = cumulative g CO₂e/kWh, axes always static */}
        <ResponsiveContainer width="100%" height={420}>
          <LineChart
            data={visibleData}
            margin={{ top: 10, right: 40, left: 20, bottom: 24 }}
          >
            <CartesianGrid horizontal={true} vertical={false} stroke="#f0f0f0" />

            <XAxis
              type="number"
              dataKey="year"
              domain={[1, 30]}
              ticks={Y_TICKS}
              tick={{ fontFamily: 'sans-serif', fontSize: 12, fill: '#aaa' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Year', position: 'insideBottom', offset: -14, fill: '#bbb', fontSize: 11 }}
            />

            <YAxis
              type="number"
              domain={X_DOMAIN}
              ticks={X_TICKS}
              tickFormatter={fmtX}
              tick={{ fontFamily: 'sans-serif', fontSize: 12, fill: '#aaa' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Cumulative g CO₂e / kWh', angle: -90, position: 'insideLeft', offset: -4, fill: '#bbb', fontSize: 11 }}
            />

            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />

            <Line type="monotone" dataKey="Solar" stroke="#fe470d" strokeWidth={2.5} dot={{ r: 4, fill: '#fe470d', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="Gas"   stroke="#1a1110" strokeWidth={2.5} dot={{ r: 4, fill: '#1a1110', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="Coal"  stroke="#353935" strokeWidth={2.5} dot={{ r: 4, fill: '#353935', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>

        {/* Slider */}
        <div style={{ marginTop: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#888' }}>Drag to reveal years</span>
            <span style={{
              fontSize: 15, fontWeight: 700, color: '#fe470d',
              background: '#fff4f1', padding: '2px 14px', borderRadius: 20,
            }}>
              Year {sliderYear}
            </span>
          </div>

          <div style={{ position: 'relative', height: 28 }}>
            <div style={{
              position: 'absolute', top: '50%', left: 0, right: 0,
              height: 8, borderRadius: 8, background: '#f0f0f0', transform: 'translateY(-50%)',
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: 0,
              width: `${((sliderYear - 1) / 29) * 100}%`,
              height: 8, borderRadius: 8, background: '#fe470d', transform: 'translateY(-50%)',
            }} />
            <input
              type="range" min={1} max={30} value={sliderYear}
              onChange={e => setSliderYear(Number(e.target.value))}
              style={{
                position: 'absolute', top: '50%', left: 0, width: '100%',
                height: 28, transform: 'translateY(-50%)', opacity: 0, cursor: 'pointer', margin: 0,
              }}
            />
            <div style={{
              position: 'absolute', top: '50%',
              left: `calc(${((sliderYear - 1) / 29) * 100}% - 14px)`,
              width: 28, height: 28, borderRadius: '50%', background: '#fe470d',
              transform: 'translateY(-50%)', boxShadow: '0 2px 8px rgba(254,71,13,0.4)',
              pointerEvents: 'none',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: '#bbb' }}>
            {[1, 5, 10, 15, 20, 25, 30].map(y => <span key={y}>{y}</span>)}
          </div>
        </div>

        <p style={{ marginTop: 28, fontSize: 11, color: '#ccc', lineHeight: 1.7, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          Source: excel.xlsx. Solar embodied carbon 600,000 g CO₂e/kWp, yield 1,022 kWh/kWp/yr (Medebridge).
          Gas 490 g CO₂e/kWh · Coal 820 g CO₂e/kWh (IPCC lifecycle medians).
        </p>
      </div>
    </div>
  );
}
