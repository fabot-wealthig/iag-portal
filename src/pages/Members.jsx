import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, getSession, clearSession } from '../lib/api'

export default function Members() {
  const navigate = useNavigate()
  const session = getSession()

  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Gate: no session means nothing on this page should render or fetch.
    // (A token that has expired server-side is caught separately — callApi
    // clears the session and hard-redirects on a 401.)
    if (!session) {
      navigate('/', { replace: true })
      return
    }
    let cancelled = false
    callApi('load_members')
      .then(data => {
        if (cancelled) return
        setMembers(data.members || [])
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLogout() {
    clearSession()
    navigate('/', { replace: true })
  }

  if (!session) return null

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">IAG Portal</span>
        <div className="topbar-right">
          <span className="who">{session.name || session.email}</span>
          <button type="button" className="btn-quiet" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="page">
        <h1 className="page-title">Members</h1>

        {loading && <p className="msg-muted">Loading members…</p>}
        {!loading && error && <p className="msg-error" role="alert">{error}</p>}

        {!loading && !error && members.length === 0 && (
          <p className="msg-muted">No members yet.</p>
        )}

        {!loading && !error && members.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member #</th>
                  <th>First</th>
                  <th>Last</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.member_number}>
                    <td>{m.member_number}</td>
                    <td>{m.first_name}</td>
                    <td>{m.last_name}</td>
                    <td>{m.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
