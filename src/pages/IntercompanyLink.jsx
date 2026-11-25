import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession } from '../lib/api'
import { saveIntercompanyLink } from '../lib/intercompanyLink'

// /inter-company-transfers?request=<id>, the link in VFO's email. Holds nothing and shows
// nothing: it remembers the request and sends the person to the portal, or to sign in first.
export default function IntercompanyLink() {
  const navigate = useNavigate()

  useEffect(() => {
    saveIntercompanyLink(new URLSearchParams(window.location.search).get('request'))
    navigate(getSession() ? '/portal' : '/login', { replace: true })
  }, [navigate])

  return null
}
