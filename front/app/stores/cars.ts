import { collection, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useCollection, useFirestore } from 'vuefire'
import { defineStore } from 'pinia'

export type CarStatus = 'activation_pending' | 'active' | 'deleted' | 'rejected' 

export const useCarsStore = defineStore('cars', () => {
  const authStore = useAuthStore()
  const db = useFirestore()
  const toast = useToast()

  const carsRef = computed(() => {
    if (!authStore.currentUser?.uid) return null
    return query(collection(db, 'cars'), where('ownerId', '==', authStore.currentUser.uid))
  })

  const { data: myCars, pending: carsLoading } = useCollection(carsRef, { ssrKey: 'ownerCars' })

  const actionLoading = ref(false)

  async function addCar(payload: { plateNumber: string; brand: string; model: string; color: string; carteGriseUrl: string }) {
    actionLoading.value = true
    try {
      const { $functions } = useNuxtApp()
      const addCarFn = httpsCallable($functions, 'addCar')
      await addCarFn(payload)
      toast.add({ title: 'Car added successfully', color: 'success' })
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      toast.add({ title: 'Error adding car', description: msg, color: 'error' })
      throw e
    } finally {
      actionLoading.value = false
    }
  }

  async function requestDeletion(carId: string) {
    actionLoading.value = true
    try {
      const { $functions } = useNuxtApp()
      const requestDeletionFn = httpsCallable($functions, 'requestCarDeletion')
      await requestDeletionFn({ carId })
      toast.add({ title: 'Deletion requested', description: 'Pending police approval', color: 'amber' })
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      toast.add({ title: 'Error requesting deletion', description: msg, color: 'error' })
      throw e
    } finally {
      actionLoading.value = false
    }
  }

  async function cancelDeletion(carId: string) {
    actionLoading.value = true
    try {
      const { $functions } = useNuxtApp()
      const cancelDeletionFn = httpsCallable($functions, 'cancelCarDeletion')
      await cancelDeletionFn({ carId })
      toast.add({ title: 'Deletion request cancelled', description: 'Your vehicle is active again', color: 'success' })
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      toast.add({ title: 'Error cancelling deletion', description: msg, color: 'error' })
      throw e
    } finally {
      actionLoading.value = false
    }
  }

  return {
    myCars,
    carsLoading,
    actionLoading,
    addCar,
    requestDeletion,
    cancelDeletion,
  }
})
