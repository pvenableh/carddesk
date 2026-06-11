/**
 * POST /api/location/nearby — turn the user's coordinates into a suggested
 * Location (city/region) plus a short list of nearby venues for "Where We Met".
 * Body: { lat: number, lng: number }
 *
 * The Google Places/Geocoding key lives only here (server-side). With no key the
 * whole feature is off — we return { enabled: false } and the client hides the UI
 * so there are never any (billable) calls. Login-gated so it can't be abused.
 */
import { getValidToken } from '../../utils/auth'

interface Venue { name: string; address: string | null }

export default defineEventHandler(async (event) => {
  await getValidToken(event) // require a signed-in user

  const key = useRuntimeConfig().googlePlacesApiKey as string
  if (!key) return { enabled: false }

  const body = await readBody(event)
  const lat = Number(body?.lat)
  const lng = Number(body?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    throw createError({ statusCode: 400, message: 'lat and lng are required' })

  // Run the two lookups in parallel; either failing shouldn't sink the other.
  const [place, venues] = await Promise.all([
    reverseGeocode(lat, lng, key).catch((e) => { console.error('[location] geocode', e); return null }),
    nearbyVenues(lat, lng, key).catch((e) => { console.error('[location] nearby', e); return [] as Venue[] }),
  ])

  return {
    enabled: true,
    location: place?.label ?? null,
    city: place?.city ?? null,
    region: place?.region ?? null,
    venues,
  }
})

/** Coords → "City, ST" using the Geocoding API. */
async function reverseGeocode(lat: number, lng: number, key: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`
  const res = (await $fetch(url)) as any
  const comps: any[] = res?.results?.[0]?.address_components ?? []
  const get = (type: string, short = false) => {
    const c = comps.find((x) => x.types?.includes(type))
    return c ? (short ? c.short_name : c.long_name) : null
  }
  const city = get('locality') ?? get('postal_town') ?? get('sublocality') ?? get('administrative_area_level_2')
  const region = get('administrative_area_level_1', true)
  const label = [city, region].filter(Boolean).join(', ') || (res?.results?.[0]?.formatted_address ?? null)
  return { city, region, label }
}

/** Coords → nearest few named venues (Places API New, ranked by distance). */
async function nearbyVenues(lat: number, lng: number, key: string): Promise<Venue[]> {
  const res = (await $fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress',
    },
    body: {
      maxResultCount: 8,
      rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 200 } },
    },
  })) as any
  const places: any[] = res?.places ?? []
  const seen = new Set<string>()
  const venues: Venue[] = []
  for (const p of places) {
    const name = p?.displayName?.text
    if (!name || seen.has(name)) continue
    seen.add(name)
    venues.push({ name, address: p?.formattedAddress ?? null })
    if (venues.length >= 6) break
  }
  return venues
}
