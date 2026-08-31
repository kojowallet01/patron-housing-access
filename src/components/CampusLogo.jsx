const CAMPUS_LOGO_FILES = {
  'TESANO CAMPUS': '/logo-tesano.png',
  'LEGON CAMPUS': '/logo-legon.png',
  'CANTOMENT CAMPUS': '/logo-cantoment.png',
  'TEMA CAMPUS': '/logo-tema.png'
}

function CampusLogo({ campus, className = '', ...props }) {
  const file = CAMPUS_LOGO_FILES[campus]
  if (!file) return null
  return <img src={file} alt={campus} className={`campus-logo-img ${className}`} {...props} />
}

export default CampusLogo
