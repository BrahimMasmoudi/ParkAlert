import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

function simpleRef<T>(initial: T) {
  return { value: initial };
}

function simpleComputed<T>(getter: () => T) {
  return {
    get value() {
      return getter();
    },
  };
}

const mockQueries: any[] = [];
const mockRole = simpleRef<'owner' | 'police' | 'agent' | undefined>('owner');
const mockUid = simpleRef<string | undefined>('user-1');

vi.mock('vue', () => ({
  ref: simpleRef,
  computed: simpleComputed,
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: any, name: string) => ({
    __collection: name,
    withConverter: () => ({ __collection: name }),
  }),
  where: (field: string, op: string, val: any) => ({ __where: [field, op, val] }),
  orderBy: (field: string, dir: string) => ({ __orderBy: [field, dir] }),
  limit: (n: number) => ({ __limit: n }),
  query: (...args: any[]) => {
    const q = { __query: args };
    mockQueries.push(q);
    return q;
  },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: () => vi.fn(),
}));

  vi.mock('vuefire', () => ({
  useFirestore: () => ({}),
  useCollection: (source: any) => {
    const data = simpleRef([]);
    const pending = simpleRef(false);
    const _evaluated = typeof source === 'function' ? source() : source?.value;
    return { data, pending, _evaluated };
  },
}));

vi.mock('pinia', () => ({
  defineStore: (_id: string, setup: () => any) => setup,
}));

let useCarsStore: () => any;
let useFinesStore: () => any;

beforeAll(async () => {
  (globalThis as any).computed = simpleComputed;
  (globalThis as any).ref = simpleRef;
  (globalThis as any).defineStore = (_id: string, setup: () => any) => setup;
  (globalThis as any).useAuthStore = () => ({
    get currentUser() {
      return mockUid.value ? { uid: mockUid.value } : null;
    },
  });
  (globalThis as any).useUserStore = () => ({
    get role() {
      return mockRole.value;
    },
  });
  (globalThis as any).useToast = () => ({ add: vi.fn() });
  (globalThis as any).useNuxtApp = () => ({ $functions: {} });

  ({ useCarsStore } = await import('../app/stores/cars'));
  ({ useFinesStore } = await import('../app/stores/fines'));
});

describe('US2: Pinia Store Listener Role Gating', () => {
  beforeEach(() => {
    mockQueries.length = 0;
    mockUid.value = 'user-1';
  });

  it('does not subscribe to pendingCars or allFines when user is owner, and removes historicalCars', () => {
    mockRole.value = 'owner';
    const carsStore = useCarsStore();
    useFinesStore();

    expect((carsStore as any).historicalCars).toBeUndefined();
    const queriedCollections = mockQueries.map((q) => q.__query[0].__collection);
    // Only owner cars (`cars` with ownerId) and owner fines (`fines` with ownerId) should run
    expect(queriedCollections).toEqual(['cars', 'fines']);
    expect(mockQueries[0].__query.some((part: any) => part.__where?.[0] === 'ownerId')).toBe(true);
    expect(mockQueries[1].__query.some((part: any) => part.__where?.[0] === 'ownerId')).toBe(true);
  });

  it('subscribes to pendingCars, allFines, and pendingDisputes only when user is police', () => {
    mockRole.value = 'police';
    useCarsStore();
    useFinesStore();

    const queriedCollections = mockQueries.map((q) => q.__query[0].__collection);
    expect(queriedCollections).toEqual(['cars', 'cars', 'fines', 'fines', 'fines']);
  });
});
