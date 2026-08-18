import { useMemo } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import type { RideUnits } from '@/utils/rideFormat';

/**
 * Display units for recorded workouts, derived from the profile's weight unit
 * (kg implies metric everywhere else too). One hook instead of the same memo
 * pasted into every screen that formats a distance.
 */
export function useRideUnits(): RideUnits {
  const weightUnit = useUserStore((s) => s.profile?.weightUnit);
  return useMemo(() => ({ imperial: (weightUnit ?? 'lbs') !== 'kg' }), [weightUnit]);
}
