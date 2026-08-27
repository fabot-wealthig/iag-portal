import logoWhite from '../../assets/wig-logo-white.png'
import logoColor from '../../assets/wig-logo-color.png'
import markWhite from '../../assets/wig-mark-white.png'
import markColor from '../../assets/wig-mark-color.png'

// `mark` drops the wordmark and renders the emblem alone, so it can be sized up
// in a place too short for the full lockup to read.
export default function WigLogo({ light = false, height = 30, mark = false, onClick }) {
  const src = mark ? (light ? markWhite : markColor) : (light ? logoWhite : logoColor)
  return (
    <img
      src={src}
      alt="Wealth Innovation Group"
      height={height}
      onClick={onClick}
      style={{ display: 'block', height: `${height}px`, width: 'auto', cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}
    />
  )
}
