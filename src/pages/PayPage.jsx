import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { callApi } from '../lib/api'
import AuthShell from '../components/shared/AuthShell'
import TokenShell from '../components/shared/TokenShell'

const eyebrowStyle = { fontSize: '11.5px', color: '#EE6A33', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', margin: '0 0 10px' }
const titleStyle = { fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)', marginTop: 0, marginBottom: '8px', fontSize: '28px' }
const subStyle = { color: 'var(--wig-muted)', fontSize: '14px', marginTop: 0, marginBottom: '20px', wordBreak: 'break-word' }

const INVALID_LINK = 'This payment link is not valid. Please contact Wealth Innovation Group for a new link.'

// METHOD-NEUTRAL, because the page cannot know which one was used: Stripe's
// success return carries no token, so the done state has nothing to look the
// payment up with. Both timings are named rather than one guessed at.
const NEXT_STEPS = [
  'If you paid by bank transfer, it clears in 2 to 4 business days. A card payment settles immediately.',
  'We email you as soon as the payment is received.',
  'Your invoice and receipt follow once the payment has settled.',
]

// Public, no-login page reached from the client "payment request" email.
//
// WHICH METHODS IT OFFERS IS THE STRATEGY'S ANSWER, not this page's:
// `accepts_card` comes back from load_pay_link, and only a client_fee_pool
// strategy — the Implementation Fee — sets it. Everywhere else the portal
// collects client fees by ACH only, which is a product decision rather than a
// limitation, and offering a card the checkout would refuse to mint a session
// for is the one mistake this page must not make.
//
// A CARD IS GROSSED UP. Stripe takes 2.9% + $0.30, and the point of the
// Implementation Fee pool is that Wealth IG nets the fee — so the client is
// charged more and sees the difference on its own line. The arithmetic is
// pay-link-checkout.ts's, mirrored here so the figure quoted is the figure
// billed.
//
// We never see any bank or card details: Stripe collects them on its own hosted
// page.
export default function PayPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const justDone = searchParams.get('done') === '1'

  // 'loading' | 'ready' | 'redirecting' | 'done' | 'error'
  const [status, setStatus] = useState(justDone ? 'done' : (token ? 'loading' : 'error'))
  const [error, setError] = useState(token || justDone ? '' : INVALID_LINK)
  const [data, setData] = useState(null)
  // Which card the cursor is over, not merely whether it is over one: two cards
  // sharing a boolean would light up together.
  const [hoveredOption, setHoveredOption] = useState(null)

  useEffect(() => {
    if (justDone || !token) return
    let cancelled = false
    // The token is passed explicitly so callApi sends it instead of a session
    // token — nobody is signed in on this page.
    callApi('load_pay_link', { token })
      .then(res => {
        if (cancelled) return
        if (res.state === 'ready') { setData(res); setStatus('ready'); return }
        setError(res.error || INVALID_LINK)
        setStatus('error')
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || 'Could not load this payment. Please try again.')
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  async function startCheckout(method) {
    setStatus('redirecting')
    try {
      const res = await callApi('pay_link_checkout', { token, method })
      if (res.url) { window.location.href = res.url; return }
      setError(res.error || INVALID_LINK)
      setStatus('error')
    } catch (err) {
      setError(err.message || 'Could not start the payment. Please try again.')
      setStatus('error')
    }
  }

  // The Stripe success return carries no token, so this state has no client
  // data to show — it gets the branded standalone landing instead of the
  // split-panel shell the token states use.
  if (status === 'done') {
    return (
      <TokenShell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(27,146,84,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1b9254" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5 L10 17.5 L19 7" />
            </svg>
          </div>
          <p style={eyebrowStyle}>Payment</p>
          <h1 style={{ ...titleStyle, fontSize: '26px' }}>Payment successful</h1>
          <p style={{ color: 'var(--wig-muted)', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
            Thank you. Your payment has been submitted to Stripe and is being processed.
          </p>
        </div>

        <div style={{ background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '10px', padding: '16px 18px', marginTop: '24px', textAlign: 'left' }}>
          <p style={{ ...eyebrowStyle, marginBottom: '12px' }}>What happens next</p>
          {NEXT_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: i === 0 ? 0 : '10px' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0F355A', color: '#ffffff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: '13.5px', color: 'var(--wig-ink)', lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', lineHeight: 1.6, marginTop: '18px', marginBottom: 0, textAlign: 'left' }}>
          You can close this page. If you have a question, reply to the payment email and the Wealth Innovation Group team will help.
        </p>

        <p style={{ textAlign: 'center', color: 'var(--wig-muted)', fontSize: '12px', marginTop: '24px', marginBottom: 0, lineHeight: 1.6 }}>
          Your payment details are handled securely by Stripe.<br />
          Wealth Innovation Group never sees or stores your payment information.
        </p>
      </TokenShell>
    )
  }

  // The same arithmetic pay_link_checkout.ts charges, so the client is quoted
  // the figure they will be billed. Nothing is shown from it unless the strategy
  // accepts a card.
  const fee = Number(data?.payment_amount) || 0
  const cardTotal = Math.round((fee + 0.30) / (1 - 0.029) * 100) / 100
  const cardFee = Math.round((cardTotal - fee) * 100) / 100

  return (
    <AuthShell tagline="Secure payment of your strategy fee. Payments are handled by Stripe, and Wealth Innovation Group never sees or stores your payment details.">
      <p style={eyebrowStyle}>Wealth IG Portal</p>

      {status === 'loading' && <p style={subStyle}>Loading payment details...</p>}

      {status === 'redirecting' && <p style={subStyle}>Redirecting to Stripe...</p>}

      {status === 'error' && (
        <>
          <h1 style={titleStyle}>Something went wrong</h1>
          <p style={subStyle}>{error || INVALID_LINK}</p>
          <p style={{ ...subStyle, fontSize: '13px', color: 'var(--wig-faint)' }}>
            If you keep seeing this message, reply to the payment email and we will send you a fresh link.
          </p>
        </>
      )}

      {status === 'ready' && data && (
        <>
          <h1 style={titleStyle}>Complete your payment</h1>
          <p style={subStyle}>{data.payment_label} · {data.client_name}</p>

          <OptionCard
            isHovered={hoveredOption === 'ach'}
            onHover={() => setHoveredOption('ach')}
            onLeave={() => setHoveredOption(null)}
            onClick={() => startCheckout('ach')}
            title="ACH Bank Transfer"
            badgeText="No Fee"
            badgeClass="green"
            amount={fee}
            breakdown={[
              { label: data.payment_label, value: `$${fmtMoney(fee)}`, valueColor: 'var(--wig-ink-2)' },
              { label: 'Processing Fee', value: '$0.00', valueColor: '#16a34a' },
            ]}
            footer="Funds transfer directly from your bank account. Takes 2-4 business days to process."
          />

          {/* Only where the strategy says so. The charge is grossed up, so the
              headline figure is LARGER than the fee and the difference is named
              as the client's own cost rather than buried in the total. */}
          {data.accepts_card && (
            <>
              <div style={dividerStyle}>— or —</div>
              <OptionCard
                isHovered={hoveredOption === 'card'}
                onHover={() => setHoveredOption('card')}
                onLeave={() => setHoveredOption(null)}
                onClick={() => startCheckout('card')}
                title="Credit / Debit Card"
                badgeText="2.9% + $0.30 Fee"
                badgeClass="blue"
                amount={cardTotal}
                breakdown={[
                  { label: data.payment_label, value: `$${fmtMoney(fee)}`, valueColor: 'var(--wig-ink-2)' },
                  { label: 'Card Processing Fee (2.9% + $0.30)', value: `$${fmtMoney(cardFee)}`, valueColor: 'var(--wig-ink-2)' },
                ]}
                footer="Processes immediately. The processing fee covers card transaction costs."
              />
            </>
          )}

          <p style={{ textAlign: 'center', color: 'var(--wig-muted)', fontSize: '12px', marginTop: '24px', lineHeight: 1.6 }}>
            Your payment details are handled securely by Stripe.<br />
            Wealth Innovation Group never sees or stores your payment information.
          </p>
        </>
      )}
    </AuthShell>
  )
}

// One payment method, the whole card being the button. Extracted the way VFO's
// accountant pay page extracts it, and for the same reason: the card stopped
// being one thing the moment a second method existed, and two copies of this
// markup would be two places for a badge or a breakdown row to drift.
function OptionCard({ isHovered, onHover, onLeave, onClick, title, badgeText, badgeClass, amount, breakdown, footer }) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        ...optionCardStyle,
        borderColor: isHovered ? '#3D9BE0' : 'var(--wig-border)',
        background: isHovered ? 'rgba(61,155,224,0.05)' : 'transparent',
      }}>
      <div style={optionHeaderStyle}>
        <span style={optionTitleStyle}>{title}</span>
        <span style={{ ...optionBadgeBaseStyle, ...badgeStyles[badgeClass] }}>{badgeText}</span>
      </div>
      <div style={optionAmountStyle}>${fmtMoney(amount)}</div>
      <div style={{ marginBottom: '16px' }}>
        {breakdown.map((row, i) => (
          <div key={i} style={detailRowStyle}>
            <span style={{ color: 'var(--wig-muted)' }}>{row.label}</span>
            <span style={{ color: row.valueColor, fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>
      <div style={optionFooterStyle}>{footer}</div>
    </div>
  )
}

const detailRowStyle = { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '4px 0', fontSize: '13px' }
// The card the ACH-only page has always drawn, lifted out unchanged — no margin
// of its own, so a page offering one method sits exactly where it did and the
// gap between two of them belongs to the divider.
const optionCardStyle = { border: '2px solid', borderRadius: '16px', padding: '28px', cursor: 'pointer', transition: 'all 0.2s' }
const optionHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }
const optionTitleStyle = { fontSize: '16px', fontWeight: 700, color: 'var(--wig-ink)' }
const optionBadgeBaseStyle = { fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
// Green for the method that costs the client nothing, the portal's own blue for
// the one that does: the badge is the difference between the two cards, said
// before either figure is read.
const badgeStyles = { green: { background: 'rgba(34,197,94,0.15)', color: '#16a34a' }, blue: { background: 'rgba(61,155,224,0.15)', color: '#3D9BE0' } }
const optionAmountStyle = { fontSize: '28px', fontWeight: 700, color: 'var(--wig-ink)', marginBottom: '16px' }
const optionFooterStyle = { fontSize: '12px', color: 'var(--wig-muted)', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--wig-border-soft)' }
const dividerStyle = { textAlign: 'center', color: 'var(--wig-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', margin: '8px 0' }

const fmtMoney = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
