export const regionUrl = (id: string) => `/regions/${encodeURIComponent(id)}`
export const apartmentUrl = (id: string) => `/apartments/${id}`
export const inputUrl = (opts?: { apt?: string; unit?: string }) => {
  const q = new URLSearchParams()
  if (opts?.apt) q.set('apt', opts.apt)
  if (opts?.unit) q.set('unit', opts.unit)
  const s = q.toString()
  return `/input${s ? `?${s}` : ''}`
}
