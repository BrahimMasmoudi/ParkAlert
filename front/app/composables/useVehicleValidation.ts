export const useVehicleValidation = () => {
  const frenchPlateRegex = /^([A-Z]{2}[-\s]?\d{3}[-\s]?[A-Z]{2}|\d{1,4}[-\s]?[A-Z]{2,3}[-\s]?\d{2,3})$/i

  const isFrenchPlateValid = (plate: string) => {
    if (!plate) return false
    return frenchPlateRegex.test(plate.trim())
  }

  const formatFrenchPlate = (val: string) => {
    let cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
    
    // If it starts with 2 letters (SIV format or generic XX-YYY-ZZ)
    if (/^[A-Z]{2}/.test(cleaned) && cleaned.length > 2) {
      if (cleaned.length <= 5) {
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`
      } else {
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5, 7)}`
      }
    }
    
    // If it starts with numbers (FNI format: 1234 AB 56)
    if (/^[0-9]+/.test(cleaned)) {
      const match = cleaned.match(/^(\d{1,4})([A-Z]{1,3})?(\d{1,3})?$/)
      if (match) {
        let res = match[1]
        if (match[2]) res += '-' + match[2]
        if (match[3]) res += '-' + match[3]
        return res
      }
    }

    return cleaned
  }

  return {
    frenchPlateRegex,
    isFrenchPlateValid,
    formatFrenchPlate
  }
}
