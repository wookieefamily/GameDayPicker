// Brand configs for white-label partners.
// Apply with ?brand=cal (or other key) on any poll URL.

export const BRANDS = {
  cal: {
    name:       'California Golden Bears',
    shortName:  'Cal Golden Bears',
    logo:       '/cal-logo.png',
    // Primary accent replaces the default orange (#fd5a1e)
    accent:     '#FDB515',           // California Gold
    accentText: '#002676',           // Berkeley Blue — text on gold buttons
    accentRgb:  '253, 181, 21',      // for rgba() usage
    // Backgrounds
    pageBg:     'linear-gradient(160deg, #000D1A 0%, #001848 55%, #000D1A 100%)',
    headerBg:   'linear-gradient(90deg, #001230, #002676)',
  },
}

export function getBrand(key) {
  return key ? (BRANDS[key] ?? null) : null
}
