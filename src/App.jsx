import { useState } from 'react'
import SolarFieldMockup from './components/SolarFieldMockup.jsx'
import ManufacturingChart from './components/ManufacturingChart.jsx'
import MaintenanceTable from './components/MaintenanceTable.jsx'

export default function App() {
  const [view, setView] = useState('field')
  if (view === 'chart')       return <ManufacturingChart onBack={() => setView('field')} />
  if (view === 'maintenance') return <MaintenanceTable   onBack={() => setView('field')} />
  return (
    <SolarFieldMockup
      onShowChart={() => setView('chart')}
      onShowMaintenance={() => setView('maintenance')}
    />
  )
}
