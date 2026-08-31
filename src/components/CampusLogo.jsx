import { CAMPUS_COLORS } from '../config'

const CAMPUS_LOGO_FILES = {
  'TESANO CAMPUS': '/logo-tesano.png',
  'LEGON CAMPUS': '/logo-legon.png',
  'CANTOMENT CAMPUS': '/logo-cantoment.png',
  'TEMA CAMPUS': '/logo-tema.png'
}

function CampusLogo({ campus, className = '', style = {}, ...props }) {
  const file = CAMPUS_LOGO_FILES[campus]
  if (!file) return null

  const bg = CAMPUS_COLORS[campus]
  return (
    <span
      className={`campus-logo-bg ${className}`}
      style={{ backgroundColor: bg, ...style }}
    >
      <img src={file} alt={campus} className="campus-logo-img" {...props} />
    </span>
  )
}

export default CampusLogo
