import { useUserStore } from '@/lib/stores/userStore'

export function useUser() {
  const { user, clinic, doctor } = useUserStore()
  return {
    user,
    clinic,
    doctor,
    isLoading: user === null,
  }
}
