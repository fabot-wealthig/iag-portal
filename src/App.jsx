import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLogin from './pages/AdminLogin'
import Members from './pages/Members'
import SetPassword from './pages/SetPassword'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AdminLogin />} />
      <Route path="/members" element={<Members />} />
      <Route path="/set-password" element={<SetPassword />} />
      {/* Unknown paths go to the login page rather than a dead end — the page
          itself forwards on to /members when a session already exists. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
