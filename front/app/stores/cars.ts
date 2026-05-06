// stores/cars.ts
import { collection, query, where } from 'firebase/firestore'
import type {
  QueryDocumentSnapshot,
  SnapshotOptions,
  DocumentData
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useCollection, useFirestore } from 'vuefire'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type CarStatus =
  | 'activation_pending'
  | 'deletion_requested'
  | 'active'
  | 'deleted'
  | 'rejected'
  | 'transfer_pending_owner'
  | 'transfer_pending_police'

export const carStatusMapper: Record<CarStatus, string> = {
  activation_pending: 'Activation Pending',
  deletion_requested: 'Deletion Pending',
  active: 'Active',
  deleted: 'Deleted',
  rejected: 'Rejected',
  transfer_pending_owner: 'Awaiting Owner Acceptance',
  transfer_pending_police: 'Awaiting Police Approval'
}

export interface Car {
  id: string
  ownerId: string
  plateNumber: string
  brand: string
  model: string
  color: string
  carteGriseUrl?: string
  status: CarStatus
  createdAt: number
  rejectionReason?: string
  transferRejectionReason?: string
  transferToOwnerId?: string
  transferCarteGriseUrl?: string
}

function getTimestampMillis(ts: any): number {
  if (!ts) return Date.now()
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts.seconds) return ts.seconds * 1000
  if (ts._seconds) return ts._seconds * 1000
  return new Date(ts).getTime()
}

const carConverter = {
  toFirestore(car: Car): DocumentData {
    return car
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): Car {
    const data = snapshot.data(options)

    return {
      id: snapshot.id,
      ownerId: data.ownerId || '',
      plateNumber: data.plateNumber || '',
      brand: data.brand || '',
      model: data.model || '',
      color: data.color || '',
      carteGriseUrl: data.carteGriseUrl || '',
      status: data.status || 'activation_pending',
      createdAt: getTimestampMillis(data.createdAt),
      rejectionReason: data.rejectionReason,
      transferRejectionReason: data.transferRejectionReason,
      transferToOwnerId: data.transferToOwnerId,
      transferCarteGriseUrl: data.transferCarteGriseUrl
    }
  }
}

export const useCarsStore = defineStore('cars', () => {
  const authStore = useAuthStore()
  const db = useFirestore()
  const toast = useToast()

  const loadingIds = ref<Set<string>>(new Set())

  function isLoading(id: string) {
    return loadingIds.value.has(id)
  }

  async function withLoading<T>(id: string, fn: () => Promise<T>) {
    loadingIds.value.add(id)
    try {
      return await fn()
    } finally {
      loadingIds.value.delete(id)
    }
  }

  /**
   * USER CARS
   */
  const carsRef = computed(() => {
    if (!authStore.currentUser?.uid) return null

    return query(
      collection(db, 'cars').withConverter(carConverter),
      where('ownerId', '==', authStore.currentUser.uid)
    )
  })

  const {
    data: myCars,
    pending: carsLoading
  } = useCollection(carsRef, {
    ssrKey: 'ownerCars'
  })

  /**
   * HISTORICAL CARS
   */
  const historicalCarsRef = computed(() => {
    if (!authStore.currentUser?.uid) return null

    return query(
      collection(db, 'cars').withConverter(carConverter),
      where('ownershipHistory', 'array-contains', authStore.currentUser.uid)
    )
  })

  const {
    data: historicalCars,
    pending: historicalCarsLoading
  } = useCollection(historicalCarsRef, {
    ssrKey: 'historicalCars'
  })

  /**
   * POLICE PENDING ACTIONS
   */
  const pendingCarsRef = computed(() =>
    query(
      collection(db, 'cars').withConverter(carConverter),
      where('status', 'in', ['activation_pending', 'deletion_requested', 'transfer_pending_owner', 'transfer_pending_police'])
    )
  )

  const {
    data: pendingCars,
    pending: pendingCarsLoading
  } = useCollection(pendingCarsRef, {
    ssrKey: 'pendingCars'
  })

  const activationPendingCars = computed(() =>
    (pendingCars.value || []).filter(
      car => car.status === 'activation_pending'
    )
  )

  const deletionPendingCars = computed(() =>
    (pendingCars.value || []).filter(
      car => car.status === 'deletion_requested'
    )
  )

  const transferPendingOwnerCars = computed(() =>
    (pendingCars.value || []).filter(
      car => car.status === 'transfer_pending_owner'
    )
  )

  const transferPendingPoliceCars = computed(() =>
    (pendingCars.value || []).filter(
      car => car.status === 'transfer_pending_police'
    )
  )

  async function callFn(name: string, payload?: any) {
    const { $functions } = useNuxtApp()
    const fn = httpsCallable($functions, name)
    return await fn(payload)
  }

  async function addCar(payload: {
    plateNumber: string
    brand: string
    model: string
    color: string
    carteGriseUrl: string
  }) {
    return withLoading('newCar', async () => {
      await callFn('addCar', payload)

      toast.add({
        title: 'Car added successfully',
        color: 'success'
      })
    })
  }

  async function retryCar(payload: {
    carId: string
    plateNumber: string
    brand: string
    model: string
    color: string
    carteGriseUrl: string
  }) {
    return withLoading('newCar', async () => {
      await callFn('retryCar', payload)

      toast.add({
        title: 'Registration resubmitted',
        color: 'success'
      })
    })
  }

  async function checkPlate(plateNumber: string) {
    const res = await callFn('checkPlate', { plateNumber })
    return res.data as { available: boolean, status?: CarStatus }
  }

  async function requestOwnershipTransfer(payload: {
    plateNumber: string
    carteGriseUrl: string
  }) {
    return withLoading(`transfer-${payload.plateNumber}`, async () => {
      await callFn('requestOwnershipTransfer', payload)

      toast.add({
        title: 'Transfer requested',
        description: 'The current owner has been notified to accept the transfer.',
        color: 'success'
      })
    })
  }

  async function acknowledgeTransfer(carId: string) {
    return withLoading(`${carId}-acknowledge`, async () => {
      await callFn('acknowledgeTransfer', { carId })

      toast.add({
        title: 'Transfer acknowledged',
        description: 'Now waiting for police final approval.',
        color: 'success'
      })
    })
  }

  async function approveCar(carId: string) {
    return withLoading(`${carId}-approve`, async () => {
      await callFn('approveCar', { carId })

      toast.add({
        title: 'Car approved',
        color: 'success'
      })
    })
  }

  async function rejectCar(carId: string, reason: string) {
    return withLoading(`${carId}-reject`, async () => {
      await callFn('rejectCar', { carId, reason })

      toast.add({
        title: 'Car rejected',
        color: 'error'
      })
    })
  }

  async function approveTransfer(carId: string) {
    return withLoading(`${carId}-approve`, async () => {
      await callFn('approveTransfer', { carId })

      toast.add({
        title: 'Transfer approved',
        color: 'success'
      })
    })
  }

  async function rejectTransfer(carId: string, reason: string) {
    return withLoading(`${carId}-reject`, async () => {
      await callFn('rejectTransfer', { carId, reason })

      toast.add({
        title: 'Transfer rejected',
        color: 'success'
      })
    })
  }

  async function approveDeletion(carId: string) {
    return withLoading(carId, async () => {
      await callFn('approveCarDeletion', { carId })

      toast.add({
        title: 'Deletion approved',
        color: 'success'
      })
    })
  }
  // ADD this method inside your store
  async function requestDeletion(carId: string) {
    return withLoading(carId, async () => {
      await callFn('requestCarDeletion', { carId })

      toast.add({
        title: 'Deletion requested',
        color: 'warning'
      })
    })
  }

  async function cancelCarDeletion(carId: string) {
    return withLoading(carId, async () => {
      await callFn('cancelCarDeletion', { carId })

      toast.add({
        title: 'Deletion cancelled',
        color: 'warning'
      })
    })
  }

  async function getCarByPlate(plateNumber: string) {
    const q = query(
      collection(db, 'cars').withConverter(carConverter),
      where('plateNumber', '==', plateNumber),
      where('status', '==', 'active')
    )
    const { getDocs } = await import('firebase/firestore')
    const snap = await getDocs(q)
    if (snap.empty) return null
    return snap.docs[0].data()
  }

  return {
    myCars,
    carsLoading,
    pendingCars,
    pendingCarsLoading,
    activationPendingCars,
    deletionPendingCars,
    transferPendingOwnerCars,
    transferPendingPoliceCars,
    historicalCars,
    historicalCarsLoading,
    isLoading,
    addCar,
    checkPlate,
    retryCar,
    requestOwnershipTransfer,
    acknowledgeTransfer,
    approveCar,
    rejectCar,
    approveTransfer,
    rejectTransfer,
    approveDeletion,
    requestDeletion,
    cancelCarDeletion,
    getCarByPlate
  }
})