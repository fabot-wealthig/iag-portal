// Faint decorative background mark for the navy panels — nested parallelogram
// chevrons echoing the V in the Wealth Innovation Group logo.
const SCALES = [1, 0.72, 0.44]

export default function ChevronMotif({ size, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      {SCALES.map(s => (
        <g key={s} transform={`translate(12 11) scale(${s}) translate(-12 -11)`}>
          <polygon points="1,2 5,2 12,20 8,20" fill="none" stroke="#ffffff" strokeWidth={0.5 / s} />
          <polygon points="23,2 19,2 12,20 16,20" fill="none" stroke="#ffffff" strokeWidth={0.5 / s} />
        </g>
      ))}
    </svg>
  )
}
