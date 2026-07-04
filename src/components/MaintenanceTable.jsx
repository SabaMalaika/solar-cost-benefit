import React, { useState, useEffect, useRef } from 'react';

const GAS_COST_85  = 350000;
const GAS_COST_332 = 136676;
const SOLAR_COST   = 6000;

const POPUPS = {
  loadFactorLabel: {
    title: 'Load Factor',
    body: 'How much electricity a plant actually generates, compared to the maximum it could generate if it ran at full output 24/7, 365 days a year — 8,760 hours.',
    formula: 'Load factor = Actual annual generation ÷ (Capacity × 8,760 hours in a year)',
  },
  solar11: {
    title: '11% — Solar load factor',
    body: 'The sun isn\'t out at night, it\'s weaker in winter, and clouds reduce output — so it\'s only running at "full capacity" for the equivalent of about 1 in every 9 hours of the year.',
  },
  gas85: {
    title: '85% — Gas (LCOE model assumption)',
    body: 'A gas plant can run almost continuously, since it\'s not weather-dependent. 85% is the assumption used in the official UK government LCOE model.',
  },
  gas332: {
    title: '33.2% — Real-world UK average (2023)',
    body: 'Realistically today — gas is increasingly used as flexible backup for wind and solar rather than running constantly. So real-world gas plants are running at around 33.2% in 2023.',
  },
  gas350k: {
    title: '≈ £350,000/year — How this is calculated',
    body: null,
    calc: [
      { label: 'Full-capacity annual generation', value: '1 MW × 8,760 hrs/year = 8,760 MWh' },
      { label: 'At 85% load factor',              value: '8,760 × 0.85 = 7,446 MWh/year' },
      { label: 'Cost per MWh (£2 + £2 + £43)',    value: '£47/MWh' },
      { label: 'Total',                            value: '£47 × 7,446 = £349,962 ≈ £350,000/year' },
    ],
  },
  gas136k: {
    title: '≈ £136,676/year — How this is calculated',
    body: null,
    calc: [
      { label: 'At 33.2% load factor',           value: '8,760 × 0.332 = 2,908 MWh/year' },
      { label: 'Cost per MWh (£2 + £2 + £43)',   value: '£47/MWh' },
      { label: 'Total',                           value: '£47 × 2,908 = £136,676/year' },
    ],
  },
};

const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fe470d" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4"/>
    <line x1="12" y1="2"  x2="12" y2="5"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="4.22"  y1="4.22"  x2="6.34"  y2="6.34"/>
    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
    <line x1="2"  y1="12" x2="5"  y2="12"/>
    <line x1="19" y1="12" x2="22" y2="12"/>
    <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66"/>
    <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22"/>
  </svg>
);

const FlameIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fe470d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C12 2 7 8 7 13a5 5 0 0010 0c0-2-1.5-4-2-5-0.5 2-2 3-2 3S12 9 12 2z"/>
  </svg>
);

function Popup({ id, children, activePopup, setActivePopup }) {
  const ref   = useRef(null);
  const isOpen = activePopup === id;

  useEffect(() => {
    if (!isOpen) return;
    function onOut(e) { if (ref.current && !ref.current.contains(e.target)) setActivePopup(null); }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [isOpen, setActivePopup]);

  const p = POPUPS[id];
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline' }}>
      <span onClick={() => setActivePopup(isOpen ? null : id)}
        style={{ cursor: 'pointer', borderBottom: '1px dashed #bbb' }}>
        {children}
      </span>
      {isOpen && (
        <div style={{
          position: 'absolute', zIndex: 200, bottom: 'calc(100% + 10px)', left: 0,
          background: '#fff', border: '1px solid #e8e8e8',
          borderRadius: 10, padding: '14px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          width: 300, fontFamily: 'sans-serif', fontSize: 13, color: '#333',
          lineHeight: 1.6, textAlign: 'left',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#111' }}>{p.title}</div>
          {p.body && <div style={{ marginBottom: p.formula || p.calc ? 10 : 0 }}>{p.body}</div>}
          {p.formula && (
            <div style={{
              background: '#f7f7f7', borderRadius: 6, padding: '8px 10px',
              fontFamily: 'monospace', fontSize: 11.5, color: '#444',
            }}>{p.formula}</div>
          )}
          {p.calc && p.calc.map((row, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', gap: 12,
              borderTop: i === p.calc.length - 1 ? '1px solid #eee' : 'none',
              paddingTop: i === p.calc.length - 1 ? 8 : 0,
              marginTop: i === p.calc.length - 1 ? 8 : 4,
              fontWeight: i === p.calc.length - 1 ? 600 : 400,
            }}>
              <span style={{ color: '#666', fontSize: 12 }}>{row.label}</span>
              <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{row.value}</span>
            </div>
          ))}
          <div style={{
            position: 'absolute', bottom: -6, left: 18,
            width: 12, height: 12, background: '#fff',
            border: '1px solid #e8e8e8', borderTop: 'none', borderLeft: 'none',
            transform: 'rotate(45deg)',
          }} />
        </div>
      )}
    </span>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <span onClick={onToggle}
      title={on ? 'Switch to real-world 33.2%' : 'Switch to LCOE model 85%'}
      style={{
        display: 'inline-flex', alignItems: 'center',
        width: 36, height: 20, borderRadius: 10,
        background: on ? '#fe470d' : '#ccc',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.25s', flexShrink: 0,
      }}>
      <span style={{
        position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff',
        top: 3, left: on ? 19 : 3,
        transition: 'left 0.25s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </span>
  );
}

function Bar({ label, icon, value, maxValue }) {
  const pct = Math.max((value / maxValue) * 100, 0.5);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        {icon}
        <span style={{ fontSize: 13, color: '#444', fontWeight: 500, flex: 1 }}>{label}</span>
        <span style={{ fontSize: 13, color: '#111', fontWeight: 600 }}>£{value.toLocaleString()}/yr per MW</span>
      </div>
      <div style={{ background: '#f0f0f0', borderRadius: 6, height: 16, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 6,
          background: '#fe470d', transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

export default function MaintenanceTable({ onBack }) {
  const [activePopup, setActivePopup] = useState(null);
  const [highLoad, setHighLoad]       = useState(true);
  const [showGlossary, setShowGlossary] = useState(false);
  const glossaryRef = useRef(null);

  const gasCost      = highLoad ? GAS_COST_85  : GAS_COST_332;
  const gasCostLabel = highLoad ? '≈ £350,000/year' : '≈ £136,676/year';
  const gasCostKey   = highLoad ? 'gas350k' : 'gas136k';
  const loadKey      = highLoad ? 'gas85'   : 'gas332';

  useEffect(() => {
    if (!showGlossary) return;
    function onOut(e) { if (glossaryRef.current && !glossaryRef.current.contains(e.target)) setShowGlossary(false); }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [showGlossary]);

  const cell = {
    padding: '11px 16px', fontSize: 13.5, fontFamily: 'sans-serif',
    color: '#111', borderBottom: '1px solid #f0f0f0',
    verticalAlign: 'middle', textAlign: 'left',
  };
  const hdr = {
    ...cell, fontWeight: 700, fontSize: 11.5, color: '#777',
    textTransform: 'uppercase', letterSpacing: 0.6,
    background: '#fafafa', borderBottom: '2px solid #ebebeb', padding: '10px 16px',
  };
  const boldRow = {
    ...cell, fontWeight: 700, background: '#fff9f8',
    borderTop: '2px solid #ebebeb', borderBottom: 'none',
  };

  return (
    <div style={{
      background: '#fff', minHeight: '100vh',
      padding: '48px 32px', fontFamily: 'sans-serif', boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 820, margin: '0 auto' }}>

        {/* Top row: back + glossary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          {onBack ? (
            <button onClick={onBack} style={{
              background: 'none', border: '1px solid #e0e0e0', borderRadius: 20,
              padding: '6px 16px', fontSize: 12, color: '#888', cursor: 'pointer',
              fontFamily: 'sans-serif',
            }}>← Back to field</button>
          ) : <div />}

          <div ref={glossaryRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowGlossary(v => !v)} style={{
              background: 'none', border: '1px solid #ddd', borderRadius: 16,
              padding: '5px 12px', fontSize: 11, color: '#888', cursor: 'pointer',
              fontFamily: 'sans-serif',
            }}>Glossary &amp; References</button>
            {showGlossary && (
              <div style={{
                position: 'absolute', right: 0, top: 34, zIndex: 300,
                background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
                padding: '16px 18px', width: 300,
                boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
                fontSize: 12.5, lineHeight: 1.7, color: '#333',
              }}>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Glossary</div>
                <div style={{ marginBottom: 6 }}><strong>O&amp;M</strong> — Operations and Maintenance</div>
                <div style={{ marginBottom: 6 }}><strong>CCGT</strong> — Combined-Cycle Gas Turbine</div>
                <div style={{ marginBottom: 14 }}><strong>H Class</strong> — A highly advanced tier of heavy-duty gas turbines that operate at extreme combustion temperatures, achieving industry-leading electrical efficiencies</div>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>References</div>
                <div style={{ fontSize: 11.5, color: '#555', lineHeight: 1.6 }}>
                  Department for Energy Security and Net Zero (2023) <em>Electricity Generation Costs 2023</em>. London: HM Government. Available at:{' '}
                  <a href="https://assets.publishing.service.gov.uk/media/6556027d046ed400148b99fe/electricity-generation-costs-2023.pdf"
                    target="_blank" rel="noreferrer"
                    style={{ color: '#fe470d', wordBreak: 'break-all' }}>
                    assets.publishing.service.gov.uk/…/electricity-generation-costs-2023.pdf
                  </a> (Accessed: 28 June 2026).
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.2, color: '#bbb', textTransform: 'uppercase', marginBottom: 6 }}>
            Maintenance footprint
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111' }}>
            Annual O&amp;M + Fuel Cost per MW of Capacity
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#777', lineHeight: 1.6 }}>
            Solar's costs are fixed and upfront. Gas accrues fuel and carbon costs every year it runs.
          </p>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...hdr, width: '36%' }}>Component</th>
              <th style={hdr}>Solar PV (large-scale)</th>
              <th style={hdr}>Gas CCGT (H Class)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cell}>Fixed O&amp;M</td>
              <td style={cell}>£6,000/MW/year</td>
              <td style={cell}>£2/MWh (levelised)</td>
            </tr>
            <tr style={{ background: '#fafafa' }}>
              <td style={cell}>Variable O&amp;M</td>
              <td style={cell}>£0/MWh</td>
              <td style={cell}>£2/MWh</td>
            </tr>
            <tr>
              <td style={cell}>Fuel cost</td>
              <td style={cell}>£0</td>
              <td style={cell}>£43/MWh</td>
            </tr>
            <tr style={{ background: '#fafafa' }}>
              <td style={cell}>Carbon cost</td>
              <td style={cell}>£0</td>
              <td style={cell}>£60/MWh</td>
            </tr>
            <tr>
              <td style={cell}>
                <Popup id="loadFactorLabel" activePopup={activePopup} setActivePopup={setActivePopup}>
                  Assumed load factor
                </Popup>
              </td>
              <td style={cell}>
                <Popup id="solar11" activePopup={activePopup} setActivePopup={setActivePopup}>
                  11% (DESNZ assumption)
                </Popup>
              </td>
              <td style={cell}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Popup id={loadKey} activePopup={activePopup} setActivePopup={setActivePopup}>
                    {highLoad ? '85%' : '33.2%'}
                  </Popup>
                  <Toggle on={highLoad} onToggle={() => { setHighLoad(v => !v); setActivePopup(null); }} />
                  {!highLoad && <span style={{ fontSize: 11, color: '#999' }}>real-world 2023</span>}
                </div>
              </td>
            </tr>
            <tr>
              <td style={boldRow}>Annual O&amp;M + fuel cost per MW</td>
              <td style={boldRow}>≈ £6,000/year</td>
              <td style={boldRow}>
                <Popup id={gasCostKey} activePopup={activePopup} setActivePopup={setActivePopup}>
                  {gasCostLabel}
                </Popup>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bars */}
        <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: '#bbb', textTransform: 'uppercase', marginBottom: 20 }}>
            Annual cost per MW — visual comparison
          </div>
          <Bar label="Solar PV"  icon={<SunIcon />}   value={SOLAR_COST} maxValue={GAS_COST_85} />
          <Bar label="Gas CCGT"  icon={<FlameIcon />}  value={gasCost}    maxValue={GAS_COST_85} />
          {!highLoad && (
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              Gas bar reflects 33.2% real-world load factor
            </div>
          )}
        </div>

        <p style={{ marginTop: 28, fontSize: 11, color: '#ccc', lineHeight: 1.7, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          Source: UK Government Electricity Generation Costs 2023 (DESNZ), Table 3 (Solar fixed O&amp;M) and Table 10 (Gas CCGT LCOE assumptions).
        </p>
      </div>
    </div>
  );
}
