export const useVehicleValidation = () => {
  const frenchPlateRegex = /^([A-Z]{2}[-\s]?\d{3}[-\s]?[A-Z]{2}|\d{1,4}[-\s]?[A-Z]{2,3}[-\s]?\d{2,3})$/i

  const isFrenchPlateValid = (plate: string) => {
    if (!plate) return false
    return frenchPlateRegex.test(plate.trim())
  }

  return {
    frenchPlateRegex,
    isFrenchPlateValid
  }
}
