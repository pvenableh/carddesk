/**
 * Location suggestions — reads the device location (on demand, with permission)
 * and turns it into a suggested Location (city/region) plus nearby venues for
 * "Where We Met". All the Google calls happen server-side; this just gathers the
 * coordinates and surfaces the result.
 *
 * `enabled` is false when no Places key is configured (or it's switched off), so
 * callers can hide the UI entirely and never trigger a permission prompt.
 */
export interface NearbyVenue { name: string; address: string | null }
export interface LocationResult { location: string | null; venues: NearbyVenue[] }

export function useLocation() {
  const config = useRuntimeConfig()
  const enabled = computed(() => !!config.public.locationSuggest)

  // Shared so a detect kicked off in one place (e.g. the Event start panel) is
  // visible to the Add Contact screen without re-prompting.
  const detecting = useState('cd-loc-detecting', () => false)
  const error = useState<string | null>('cd-loc-error', () => null)
  const denied = useState('cd-loc-denied', () => false)
  const location = useState<string | null>('cd-loc-label', () => null)
  const venues = useState<NearbyVenue[]>('cd-loc-venues', () => [])

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!import.meta.client || !navigator.geolocation)
        return reject(new Error('Geolocation unavailable'))
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60_000,
      })
    })
  }

  /**
   * Detect → reverse-geocode + nearby venues. Returns the result (also stored in
   * the shared refs), or null if disabled / denied / failed. Never throws.
   */
  async function detect(): Promise<LocationResult | null> {
    if (!enabled.value || detecting.value) return null
    detecting.value = true
    error.value = null
    try {
      const pos = await getPosition()
      const res = (await $fetch('/api/location/nearby', {
        method: 'POST',
        body: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      })) as { enabled: boolean; location: string | null; venues: NearbyVenue[] }
      if (!res?.enabled) return null
      location.value = res.location ?? null
      venues.value = res.venues ?? []
      return { location: location.value, venues: venues.value }
    } catch (err: any) {
      // GeolocationPositionError.PERMISSION_DENIED === 1
      if (err?.code === 1) {
        denied.value = true
        error.value = 'Location access was denied — you can still type it in.'
      } else {
        error.value = "Couldn't read your location — you can still type it in."
      }
      return null
    } finally {
      detecting.value = false
    }
  }

  return { enabled, detecting, error, denied, location, venues, detect }
}
