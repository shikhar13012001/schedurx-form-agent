import { create } from 'zustand'

export interface StoreUser {
  id: string
  clinicId: string
  role: string
  fullName: string | null
  avatarUrl: string | null
}

export interface StoreClinic {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  logoUrl: string | null
}

export interface StoreDoctor {
  id: string
  fullName: string
  specialty: string | null
}

interface UserState {
  user: StoreUser | null
  clinic: StoreClinic | null
  doctor: StoreDoctor | null
  setUser: (user: StoreUser) => void
  setClinic: (clinic: StoreClinic) => void
  setDoctor: (doctor: StoreDoctor | null) => void
  clear: () => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  clinic: null,
  doctor: null,
  setUser: (user) => set({ user }),
  setClinic: (clinic) => set({ clinic }),
  setDoctor: (doctor) => set({ doctor }),
  clear: () => set({ user: null, clinic: null, doctor: null }),
}))
