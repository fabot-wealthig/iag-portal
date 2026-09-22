// Faint decorative background mark for the navy panels: the Innovation Advisory
// Group mark in outline (the orange stroke and its arrow tip, the navy stroke,
// and the A's apex and base), nested at three scales.
const SCALES = [1, 0.72, 0.44]

const SHAPES = [
  '0.5,23.3 3.4,23.3 12,8.2 12.7,9.4 14.1,6.9 12,3.2',
  '17.9,3.4 19.2,5.7 20.6,0.7',
  '6.2,23.3 9.1,23.3 18.4,6.9 17,4.4',
  '15.6,14.5 16.3,15.8 19.2,15.8 17,12',
  '15.6,17 19.9,17 23.5,23.3 10.6,23.3 12,20.8 19.2,20.8 18.4,19.5 14.1,19.5',
]

export default function ChevronMotif({ size, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      {SCALES.map(s => (
        <g key={s} transform={`translate(12 12) scale(${s}) translate(-12 -12)`}>
          {SHAPES.map(points => (
            <polygon key={points} points={points} fill="none" stroke="#ffffff" strokeWidth={0.5 / s} strokeLinejoin="round" />
          ))}
        </g>
      ))}
    </svg>
  )
}
