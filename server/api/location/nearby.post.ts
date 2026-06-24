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

  const cfg = useRuntimeConfig()
  const key = cfg.googlePlacesApiKey as string
  if (!key) return { enabled: false }

  // Google API keys are usually locked with an HTTP-referrer restriction, but
  // server-side calls carry no Referer, so Google blocks them ("Requests from
  // referer <empty> are blocked"). Spoof the app's own URL as the Referer so a
  // referrer-restricted key accepts the request. The key authorizes
  // "*.earnest.guru/*", and the app lives at carddesk.earnest.guru — use that
  // canonical origin so lookups work in prod AND local dev (where APP_URL is
  // localhost, which the restricted key would reject). Defer to APP_URL only
  // when it's already an earnest.guru host. The trailing slash matters: the
  // "…/*" pattern requires a path segment to match.
  const appUrl = (cfg.public.appUrl as string) || ''
  const referer = /^https:\/\/[^/]*earnest\.guru/i.test(appUrl)
    ? (appUrl.endsWith('/') ? appUrl : `${appUrl}/`)
    : 'https://carddesk.earnest.guru/'

  const body = await readBody(event)
  const lat = Number(body?.lat)
  const lng = Number(body?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    throw createError({ statusCode: 400, message: 'lat and lng are required' })

  // Run the two lookups in parallel; either failing shouldn't sink the other.
  const [place, venues] = await Promise.all([
    reverseGeocode(lat, lng, key, referer).catch((e) => { logGoogleErr('geocode', e); return null }),
    nearbyVenues(lat, lng, key, referer).catch((e) => { logGoogleErr('nearby', e); return [] as Venue[] }),
  ])

  return {
    enabled: true,
    location: place?.label ?? null,
    city: place?.city ?? null,
    region: place?.region ?? null,
    venues,
  }
})

/**
 * Surface Google's own explanation. A 403 on places:searchNearby almost always
 * means the "Places API (New)" isn't enabled on the project (it's a SEPARATE
 * product from the legacy "Places API"), or the key is restricted (HTTP-referrer
 * restriction blocks server calls; or an API allowlist that omits Places New).
 */
function logGoogleErr(label: string, e: any) {
  const body = e?.data ?? e?.response?._data
  const status = e?.status ?? e?.statusCode ?? body?.error?.code ?? ''
  // Geocoding errors come back as { error_message }; Places (New) as { error: { message } }.
  const msg = body?.error?.message ?? body?.error_message ?? body?.status ?? e?.message ?? e
  console.error(`[location] ${label} ${status} →`, msg)
}

/** Coords → "City, ST" using the Geocoding API. */
async function reverseGeocode(lat: number, lng: number, key: string, referer: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`
  const res = (await $fetch(url, referer ? { headers: { Referer: referer } } : {})) as any
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
async function nearbyVenues(lat: number, lng: number, key: string, referer: string): Promise<Venue[]> {
  const res = (await $fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress',
      ...(referer ? { Referer: referer } : {}),
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
