/**
 * nettu-scheduler 0.6.0 API client
 *
 * Confirmed endpoints:
 *   POST   /api/v1/user
 *   POST   /api/v1/user/:id/calendar            (singular)
 *   POST   /api/v1/user/:id/schedule            (singular, weekdays as "Mon"/"Tue"/etc.)
 *   POST   /api/v1/user/:id/events              body: {calendarId, startTs(ms), duration(min), busy}
 *   DELETE /api/v1/user/:id/events/:eventId
 *   GET    /api/v1/user/:id/freebusy            ?startTs=ms&endTs=ms  → {busy:[{startTs,endTs}]}
 *   POST   /api/v1/service                      body: {metadata:{}}
 *   POST   /api/v1/service/:id/users            body: {userId}
 *   PUT    /api/v1/service/:id/users/:userId    body: {availability:{variant:"Schedule",id:schedId}}
 */

const NETTU_URL = process.env.NETTU_SCHEDULER_URL
const NETTU_KEY = process.env.NETTU_ACCOUNT_API_KEY

export function isNettuConfigured(): boolean {
  return Boolean(NETTU_URL && NETTU_KEY)
}

async function nettuFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${NETTU_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': NETTU_KEY!,
      ...options.headers,
    },
  })
}

// ─── Provisioning ────────────────────────────────────────────────────────────

export async function provisionDoctor(
  doctorDbId: string,
  fullName: string
): Promise<{ nettuUserId: string; nettuCalendarId: string }> {
  const userRes = await nettuFetch('/api/v1/user', {
    method: 'POST',
    body: JSON.stringify({ metadata: { doctorId: doctorDbId, name: fullName } }),
  })
  if (!userRes.ok) throw new Error(`createUser failed: ${await userRes.text()}`)
  const nettuUserId: string = (await userRes.json()).user.id

  const calRes = await nettuFetch(`/api/v1/user/${nettuUserId}/calendar`, {
    method: 'POST',
    body: JSON.stringify({ timezone: 'Asia/Kolkata' }),
  })
  if (!calRes.ok) throw new Error(`createCalendar failed: ${await calRes.text()}`)
  const nettuCalendarId: string = (await calRes.json()).calendar.id

  return { nettuUserId, nettuCalendarId }
}

export async function ensureClinicService(clinicDbId: string, clinicName: string): Promise<string> {
  const res = await nettuFetch('/api/v1/service', {
    method: 'POST',
    body: JSON.stringify({ metadata: { clinicId: clinicDbId, name: clinicName } }),
  })
  if (!res.ok) throw new Error(`createService failed: ${await res.text()}`)
  return (await res.json()).service.id
}

export async function registerDoctorToService(serviceId: string, nettuUserId: string): Promise<void> {
  const res = await nettuFetch(`/api/v1/service/${serviceId}/users`, {
    method: 'POST',
    body: JSON.stringify({ userId: nettuUserId }),
  })
  if (!res.ok) {
    const text = await res.text()
    if (!text.toLowerCase().includes('already')) throw new Error(`registerUser failed: ${text}`)
  }
}

// Set Mon–Fri 9–17 and Sat 9–13 schedule, link it to the service.
export async function setDoctorSchedule(
  nettuUserId: string,
  _calendarId: string,
  serviceId: string
): Promise<void> {
  const wday = (day: string, startH: number, endH: number) => ({
    variant: { type: 'WDay', value: day },
    intervals: [{ start: { hours: startH, minutes: 0 }, end: { hours: endH, minutes: 0 } }],
  })

  const schedRes = await nettuFetch(`/api/v1/user/${nettuUserId}/schedule`, {
    method: 'POST',
    body: JSON.stringify({
      timezone: 'Asia/Kolkata',
      rules: [
        wday('Mon', 9, 17), wday('Tue', 9, 17), wday('Wed', 9, 17),
        wday('Thu', 9, 17), wday('Fri', 9, 17), wday('Sat', 9, 13),
      ],
    }),
  })
  if (!schedRes.ok) {
    console.warn('[nettu] setSchedule failed:', await schedRes.text())
    return
  }
  const scheduleId: string = (await schedRes.json()).schedule.id

  // Link schedule as user's availability on the service
  const availRes = await nettuFetch(`/api/v1/service/${serviceId}/users/${nettuUserId}`, {
    method: 'PUT',
    body: JSON.stringify({ availability: { variant: 'Schedule', id: scheduleId } }),
  })
  if (!availRes.ok) console.warn('[nettu] setAvailability failed:', await availRes.text())
}

// ─── Slot computation ─────────────────────────────────────────────────────────

// Working hours per weekday (0=Sun…6=Sat), IST (UTC+5:30 = 330 min)
const IST_OFFSET_MIN = 330
const WORK_HOURS: Record<number, { start: number; end: number } | null> = {
  0: null,                          // Sun — closed
  1: { start: 9 * 60, end: 17 * 60 }, // Mon
  2: { start: 9 * 60, end: 17 * 60 }, // Tue
  3: { start: 9 * 60, end: 17 * 60 }, // Wed
  4: { start: 9 * 60, end: 17 * 60 }, // Thu
  5: { start: 9 * 60, end: 17 * 60 }, // Fri
  6: { start: 9 * 60, end: 13 * 60 }, // Sat — half day
}
const SLOT_MIN = 15

function generateSlots(fromMs: number, toMs: number): { start: number; end: number }[] {
  const slots: { start: number; end: number }[] = []
  // Start from the next full 15-min boundary
  const startMs = Math.ceil(fromMs / (SLOT_MIN * 60000)) * (SLOT_MIN * 60000)

  let cursor = startMs
  while (cursor < toMs) {
    // Convert to IST minute-of-day and weekday
    const istMin = Math.floor(cursor / 60000) + IST_OFFSET_MIN
    const istDayStart = Math.floor(istMin / (24 * 60)) * (24 * 60)
    const minOfDay = istMin - istDayStart
    const weekday = new Date(cursor).getDay() // uses local time but we only need day-of-week pattern

    const hours = WORK_HOURS[weekday]
    if (hours && minOfDay >= hours.start && minOfDay + SLOT_MIN <= hours.end) {
      slots.push({ start: cursor, end: cursor + SLOT_MIN * 60000 })
    }
    cursor += SLOT_MIN * 60000
  }
  return slots
}

export async function getAvailableSlots(
  _serviceId: string,
  nettuUserId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ start: string; end: string }[]> {
  if (!isNettuConfigured()) return []
  try {
    const startTs = new Date(dateFrom).getTime()
    const endTs = new Date(dateTo).getTime()

    // Get busy periods from nettu
    const res = await nettuFetch(
      `/api/v1/user/${nettuUserId}/freebusy?startTs=${startTs}&endTs=${endTs}`
    )
    if (!res.ok) return []
    const { busy }: { busy: { startTs: number; endTs: number }[] } = await res.json()

    // Generate candidate slots
    const candidates = generateSlots(startTs, endTs)

    // Filter out slots that overlap any busy period
    const available = candidates.filter((slot) =>
      !busy.some((b) => slot.start < b.endTs && slot.end > b.startTs)
    )

    return available.map((s) => ({
      start: new Date(s.start).toISOString(),
      end: new Date(s.end).toISOString(),
    }))
  } catch (err) {
    console.warn('[nettu] getAvailableSlots failed:', err)
    return []
  }
}

// ─── Booking (calendar event) ─────────────────────────────────────────────────

export async function createBooking(
  _serviceId: string,
  nettuUserId: string,
  nettuCalendarId: string,
  start: string,
  durationMinutes: number
): Promise<{ bookingId: string }> {
  if (!isNettuConfigured()) return { bookingId: '' }
  try {
    const res = await nettuFetch(`/api/v1/user/${nettuUserId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        calendarId: nettuCalendarId,
        startTs: new Date(start).getTime(),
        duration: durationMinutes,
        busy: true,
      }),
    })
    if (!res.ok) {
      console.warn('[nettu] createBooking failed:', await res.text())
      return { bookingId: '' }
    }
    return { bookingId: (await res.json()).event.id }
  } catch (err) {
    console.warn('[nettu] createBooking error:', err)
    return { bookingId: '' }
  }
}

export async function cancelBooking(nettuUserId: string, bookingId: string): Promise<void> {
  if (!isNettuConfigured()) return
  try {
    const res = await nettuFetch(`/api/v1/user/${nettuUserId}/events/${bookingId}`, {
      method: 'DELETE',
    })
    if (!res.ok) console.warn('[nettu] cancelBooking failed:', await res.text())
  } catch (err) {
    console.warn('[nettu] cancelBooking error:', err)
  }
}
