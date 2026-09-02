import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import AdminLogin from './pages/AdminLogin'
import Portal from './pages/Portal'
import SetPassword from './pages/SetPassword'
import PayoutSetup from './pages/PayoutSetup'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/portal" element={<Portal />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/payout-setup" element={<PayoutSetup />} />
      {/* The old signed-in route — kept so a bookmark still lands somewhere real. */}
      <Route path="/members" element={<Navigate to="/portal" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
