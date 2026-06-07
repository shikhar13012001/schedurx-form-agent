'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'CLINIC_NOT_FOUND'

interface Clinic {
  id: string
  name: string
  phone: string | null
  address: string | null
  city: string | null
  logoUrl: string | null
}

interface Doctor {
  id: string
  fullName: string
  specialty: string | null
  avatarUrl: string | null
}

interface Slot {
  start: string
  end: string
}

interface SuccessData {
  appointmentId: string
  doctor: { fullName: string; specialty: string | null }
  clinic: { name: string; address: string | null }
  timeslot: string | null
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getRelativeDate(iso: string): string {
  const slot = new Date(iso)
  const today = new Date()
  const slotDay = new Date(slot.getFullYear(), slot.getMonth(), slot.getDate())
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((slotDay.getTime() - todayDay.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return slot.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

function getSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}

function buildGCalUrl(slot: string, clinic: Clinic, doctor: Doctor): string {
  const start = new Date(slot)
  const end = new Date(start.getTime() + 15 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Doctor Appointment - ${clinic.name}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Appointment with Dr. ${doctor.fullName}`,
    location: clinic.address ?? clinic.city ?? '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressDots({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 bg-white px-4 py-3 border-b border-gray-100">
      {[1, 2, 3, 4, 5].map((s) => (
        <div
          key={s}
          className={
            s === currentStep
              ? 'h-2 w-6 rounded-full bg-[#0F6E56] transition-all'
              : s < currentStep
              ? 'h-2 w-2 rounded-full bg-[#0F6E56]'
              : 'h-2 w-2 rounded-full bg-[#0F6E56]/25'
          }
        />
      ))}
    </div>
  )
}

function InputField({
  label,
  required,
  children,
  hint,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[#1a1a1a]">
        {label}
        {required && <span className="ml-0.5 text-[#0F6E56]">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[#6b7280]">{hint}</p>}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#1a1a1a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/40 focus:border-[#0F6E56] min-h-11'

function PrimaryBtn({
  onClick,
  disabled,
  children,
  loading,
}: {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full rounded-lg bg-[#0F6E56] px-4 py-3 text-sm font-semibold text-white min-h-11 disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-[#6b7280] min-h-11"
    >
      ← Back
    </button>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export interface IntakeFormProps {
  clinicId: string
  phone: string
  preSelectedDoctorId?: string
}

export default function IntakeForm({ clinicId, phone, preSelectedDoctorId }: IntakeFormProps) {
  const [step, setStep] = useState<Step>(0)
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [doctors, setDoctors] = useState<Doctor[]>([])

  // Form state
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [bookerRelation, setBookerRelation] = useState<'self' | 'proxy'>('self')
  const [proxyName, setProxyName] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [notes, setNotes] = useState('')
  const [timeslot, setTimeslot] = useState<string | null>(null)

  // Slot state
  const [selectedDate, setSelectedDate] = useState<string>('')   // 'YYYY-MM-DD'
  const [slots, setSlots] = useState<Slot[]>([])
  const [schedulerConfigured, setSchedulerConfigured] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successData, setSuccessData] = useState<SuccessData | null>(null)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 0 — fetch clinic data on mount
  useEffect(() => {
    fetch(`/api/public/clinic/${clinicId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.doctors || data.doctors.length === 0) {
          setStep('CLINIC_NOT_FOUND')
          return
        }
        setClinic(data.clinic)
        setDoctors(data.doctors)

        // Auto-select if pre-selected via URL ?doctor= param
        const pre = preSelectedDoctorId
          ? data.doctors.find((d: Doctor) => d.id === preSelectedDoctorId)
          : null

        if (pre) {
          setSelectedDoctor(pre)
          setStep(2)
        } else if (data.doctors.length === 1) {
          setSelectedDoctor(data.doctors[0])
          setStep(2)
        } else {
          setStep(1)
        }
      })
      .catch(() => setStep('CLINIC_NOT_FOUND'))
  }, [clinicId, preSelectedDoctorId])

  // Step 4 — fetch slots for a specific date when the user picks one
  const fetchSlotsForDate = useCallback((dateStr: string) => {
    if (!selectedDoctor || !dateStr) return
    setSlotsLoading(true)
    setSlots([])
    setTimeslot(null)
    // Build IST midnight-to-midnight window
    const from = new Date(`${dateStr}T00:00:00+05:30`).toISOString()
    const to   = new Date(`${dateStr}T23:59:59+05:30`).toISOString()
    fetch(
      `/api/public/slots?doctor_id=${selectedDoctor.id}&date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`
    )
      .then((r) => (r.ok ? r.json() : { slots: [], schedulerConfigured: false }))
      .then((data) => {
        setSlots(data.slots ?? [])
        setSchedulerConfigured(data.schedulerConfigured ?? false)
      })
      .catch(() => { setSlots([]); setSchedulerConfigured(false) })
      .finally(() => setSlotsLoading(false))
  }, [selectedDoctor])

  // Reset date + slots when re-entering step 4
  useEffect(() => {
    if (step === 4) {
      setSelectedDate('')
      setSlots([])
      setTimeslot(null)
    }
  }, [step])

  function validateStep2(): boolean {
    const errs: Record<string, string> = {}
    if (!fullName.trim()) errs.fullName = 'Full name is required'
    if (bookerRelation === 'proxy' && !proxyName.trim()) errs.proxyName = 'Your name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep3(): boolean {
    const errs: Record<string, string> = {}
    if (!symptoms.trim()) errs.symptoms = 'Please describe your symptoms'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!clinic || !selectedDoctor) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          doctorId: selectedDoctor.id,
          patient: {
            fullName,
            contactNumber: phone,
            age: age ? Number(age) : undefined,
            gender: gender || undefined,
          },
          appointment: {
            bookerRelation,
            proxyName: bookerRelation === 'proxy' ? proxyName : undefined,
            symptoms,
            notes: notes || undefined,
            timeslot: timeslot || undefined,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }

      setSuccessData(data)
      setStep(6)
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  // ─── Header ────────────────────────────────────────────────────────────────

  const headerSubtitle =
    step !== 0 && step !== 'CLINIC_NOT_FOUND' && step !== 6 && selectedDoctor
      ? `Dr. ${selectedDoctor.fullName}`
      : step === 6 && successData
      ? `Dr. ${successData.doctor.fullName}`
      : null

  const showProgress =
    typeof step === 'number' && step >= 1 && step <= 5

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-gray-100 py-4 px-3"
      style={{ fontFamily: 'var(--font-dm-sans, system-ui, sans-serif)' }}
    >
      <div className="mx-auto max-w-[440px]">
        {/* Card */}
        <div className="rounded-xl overflow-hidden shadow-sm">
          {/* Teal Header */}
          <div className="bg-[#0F6E56] px-4 py-3 text-white">
            <p className="font-semibold text-base leading-tight">
              {clinic?.name ?? 'ScheduRX'}
            </p>
            {headerSubtitle && (
              <p className="text-xs text-white/70 mt-0.5">{headerSubtitle}</p>
            )}
          </div>

          {/* Progress dots */}
          {showProgress && <ProgressDots currentStep={step as number} />}

          {/* Step content */}
          <div className="bg-white px-4 pt-5 pb-6">
            {step === 0 && <LoadingStep />}
            {step === 'CLINIC_NOT_FOUND' && <ClinicNotFoundStep />}
            {step === 1 && (
              <SelectDoctorStep
                doctors={doctors}
                selected={selectedDoctor}
                onSelect={setSelectedDoctor}
                onContinue={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <DetailsStep
                phone={phone}
                fullName={fullName}
                setFullName={setFullName}
                age={age}
                setAge={setAge}
                gender={gender}
                setGender={setGender}
                bookerRelation={bookerRelation}
                setBookerRelation={setBookerRelation}
                proxyName={proxyName}
                setProxyName={setProxyName}
                errors={errors}
                onBack={() => {
                  setErrors({})
                  // If we auto-selected a doctor (single doctor or pre-selected), stay on step 2 min
                  if (doctors.length > 1 && !preSelectedDoctorId) setStep(1)
                }}
                onContinue={() => {
                  if (validateStep2()) { setErrors({}); setStep(3) }
                }}
                showBack={doctors.length > 1 && !preSelectedDoctorId}
              />
            )}
            {step === 3 && (
              <SymptomsStep
                symptoms={symptoms}
                setSymptoms={setSymptoms}
                notes={notes}
                setNotes={setNotes}
                errors={errors}
                onBack={() => { setErrors({}); setStep(2) }}
                onContinue={() => {
                  if (validateStep3()) { setErrors({}); setStep(4) }
                }}
              />
            )}
            {step === 4 && (
              <SlotStep
                doctor={selectedDoctor!}
                selectedDate={selectedDate}
                onDateChange={(d) => { setSelectedDate(d); fetchSlotsForDate(d) }}
                slots={slots}
                loading={slotsLoading}
                schedulerConfigured={schedulerConfigured}
                selected={timeslot}
                onSelect={setTimeslot}
                onBack={() => setStep(3)}
                onContinue={() => setStep(5)}
              />
            )}
            {step === 5 && (
              <ReviewStep
                clinic={clinic!}
                doctor={selectedDoctor!}
                phone={phone}
                fullName={fullName}
                age={age}
                gender={gender}
                bookerRelation={bookerRelation}
                proxyName={proxyName}
                symptoms={symptoms}
                timeslot={timeslot}
                submitting={submitting}
                error={submitError}
                onBack={() => setStep(4)}
                onSubmit={handleSubmit}
              />
            )}
            {step === 6 && successData && (
              <SuccessStep
                data={successData}
                clinic={clinic!}
                doctor={selectedDoctor!}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step Components ─────────────────────────────────────────────────────────

function LoadingStep() {
  return (
    <div className="flex justify-center py-12">
      <svg className="h-8 w-8 animate-spin text-[#0F6E56]" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  )
}

function ClinicNotFoundStep() {
  return (
    <div className="py-8 text-center">
      <p className="text-lg font-semibold text-[#1a1a1a] mb-2">Clinic not found</p>
      <p className="text-sm text-[#6b7280]">Please check your link or contact the clinic.</p>
    </div>
  )
}

function SelectDoctorStep({
  doctors,
  selected,
  onSelect,
  onContinue,
}: {
  doctors: Doctor[]
  selected: Doctor | null
  onSelect: (d: Doctor) => void
  onContinue: () => void
}) {
  return (
    <div>
      <h1
        className="text-xl font-bold text-[#1a1a1a] mb-1"
        style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}
      >
        Who would you like to see?
      </h1>
      <p className="text-sm text-[#6b7280] mb-4">Select a doctor to continue</p>

      <div className="space-y-3 mb-5">
        {doctors.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => onSelect(doc)}
            className={`w-full text-left rounded-xl border-2 p-3 flex items-center gap-3 min-h-[64px] transition-colors ${
              selected?.id === doc.id
                ? 'border-[#0F6E56] bg-[#E1F5EE]'
                : 'border-gray-200 bg-white'
            }`}
          >
            {/* Avatar */}
            <div className="h-11 w-11 rounded-full bg-[#0F6E56]/10 flex items-center justify-center shrink-0">
              {doc.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.avatarUrl} alt={doc.fullName} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-[#0F6E56]">{getInitials(doc.fullName)}</span>
              )}
            </div>
            <div>
              <p className="font-semibold text-sm text-[#1a1a1a]">Dr. {doc.fullName}</p>
              {doc.specialty && <p className="text-xs text-[#6b7280] mt-0.5">{doc.specialty}</p>}
            </div>
            {selected?.id === doc.id && (
              <div className="ml-auto h-5 w-5 rounded-full bg-[#0F6E56] flex items-center justify-center shrink-0">
                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {selected && <PrimaryBtn onClick={onContinue}>Continue</PrimaryBtn>}
    </div>
  )
}

function DetailsStep({
  phone,
  fullName,
  setFullName,
  age,
  setAge,
  gender,
  setGender,
  bookerRelation,
  setBookerRelation,
  proxyName,
  setProxyName,
  errors,
  onBack,
  onContinue,
  showBack,
}: {
  phone: string
  fullName: string
  setFullName: (v: string) => void
  age: string
  setAge: (v: string) => void
  gender: string
  setGender: (v: string) => void
  bookerRelation: 'self' | 'proxy'
  setBookerRelation: (v: 'self' | 'proxy') => void
  proxyName: string
  setProxyName: (v: string) => void
  errors: Record<string, string>
  onBack: () => void
  onContinue: () => void
  showBack: boolean
}) {
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => { nameRef.current?.focus() }, [])

  return (
    <div>
      <h1
        className="text-xl font-bold text-[#1a1a1a] mb-4"
        style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}
      >
        Your details
      </h1>

      <div className="space-y-4">
        <InputField label="Full name" required>
          <input
            ref={nameRef}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Arjun Mehta"
            className={inputClass}
          />
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
        </InputField>

        <InputField
          label="Mobile number"
          hint="Wrong number? Ask the clinic to resend your booking link."
        >
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-[#1a1a1a] min-h-11 flex items-center">
            {phone}
          </div>
        </InputField>

        <InputField label="Age (optional)">
          <input
            type="number"
            min={0}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 34"
            className={inputClass}
          />
        </InputField>

        <InputField label="Gender (optional)">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {['Male', 'Female', 'Other'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(gender === g.toLowerCase() ? '' : g.toLowerCase())}
                className={`flex-1 py-2.5 text-sm font-medium min-h-11 transition-colors ${
                  gender === g.toLowerCase()
                    ? 'bg-[#0F6E56] text-white'
                    : 'bg-white text-[#6b7280]'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </InputField>

        <InputField label="Booking for">
          <div className="flex gap-3">
            {(['self', 'proxy'] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer min-h-11">
                <input
                  type="radio"
                  name="bookerRelation"
                  checked={bookerRelation === v}
                  onChange={() => setBookerRelation(v)}
                  className="accent-[#0F6E56] h-4 w-4"
                />
                <span className="text-sm text-[#1a1a1a]">
                  {v === 'self' ? 'Myself' : 'Someone else'}
                </span>
              </label>
            ))}
          </div>
        </InputField>

        {bookerRelation === 'proxy' && (
          <InputField label="Your name" required hint="The name of the person making this booking">
            <input
              type="text"
              value={proxyName}
              onChange={(e) => setProxyName(e.target.value)}
              placeholder="e.g. Rahul Mehta"
              className={inputClass}
            />
            {errors.proxyName && <p className="text-xs text-red-500 mt-1">{errors.proxyName}</p>}
          </InputField>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryBtn onClick={onContinue}>Continue</PrimaryBtn>
        {showBack && <BackBtn onClick={onBack} />}
      </div>
    </div>
  )
}

function SymptomsStep({
  symptoms,
  setSymptoms,
  notes,
  setNotes,
  errors,
  onBack,
  onContinue,
}: {
  symptoms: string
  setSymptoms: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  errors: Record<string, string>
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <div>
      <h1
        className="text-xl font-bold text-[#1a1a1a] mb-4"
        style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}
      >
        What&apos;s bothering you?
      </h1>

      <div className="space-y-4">
        <InputField label="Symptoms" required>
          <div className="relative">
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value.slice(0, 500))}
              placeholder="Describe your symptoms..."
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#1a1a1a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/40 focus:border-[#0F6E56] resize-none"
            />
            <span className="absolute bottom-2 right-2 text-xs text-[#6b7280]">
              {symptoms.length}/500
            </span>
          </div>
          {errors.symptoms && <p className="text-xs text-red-500 mt-1">{errors.symptoms}</p>}
        </InputField>

        <InputField label="Additional notes (optional)">
          <div className="relative">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 300))}
              placeholder="Any additional information for the doctor..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-[#1a1a1a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/40 focus:border-[#0F6E56] resize-none"
            />
            <span className="absolute bottom-2 right-2 text-xs text-[#6b7280]">
              {notes.length}/300
            </span>
          </div>
        </InputField>
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryBtn onClick={onContinue}>Continue</PrimaryBtn>
        <BackBtn onClick={onBack} />
      </div>
    </div>
  )
}

// Build selectable dates: next 14 days, excluding Sundays
function getSelectableDates(): { value: string; label: string }[] {
  const dates: { value: string; label: string }[] = []
  const now = new Date()
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // today midnight local

  while (dates.length < 14) {
    if (d.getDay() !== 0) { // skip Sunday
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const diff = Math.round((d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000)
      const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' })
      const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      const label = diff === 0 ? `Today, ${dateStr}` : diff === 1 ? `Tomorrow, ${dateStr}` : `${dayName}, ${dateStr}`
      dates.push({ value: iso, label })
    }
    d = new Date(d.getTime() + 86400000)
  }
  return dates
}

function SlotStep({
  doctor,
  selectedDate,
  onDateChange,
  slots,
  loading,
  schedulerConfigured,
  selected,
  onSelect,
  onBack,
  onContinue,
}: {
  doctor: Doctor
  selectedDate: string
  onDateChange: (date: string) => void
  slots: Slot[]
  loading: boolean
  schedulerConfigured: boolean
  selected: string | null
  onSelect: (s: string | null) => void
  onBack: () => void
  onContinue: () => void
}) {
  const dates = getSelectableDates()
  const dateSelected = selectedDate !== ''
  const showSlots = dateSelected && !loading && schedulerConfigured && slots.length > 0
  const showEmpty = dateSelected && !loading && (!schedulerConfigured || slots.length === 0)

  return (
    <div>
      <h1
        className="text-xl font-bold text-[#1a1a1a] mb-0.5"
        style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}
      >
        Choose a time
      </h1>
      <p className="text-sm text-[#6b7280] mb-5">With Dr. {doctor.fullName}</p>

      {/* Date dropdown */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">
          Select date <span className="text-[#0F6E56]">*</span>
        </label>
        <div className="relative">
          <select
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/40 focus:border-[#0F6E56] min-h-11"
          >
            <option value="">— Pick a date —</option>
            {dates.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {/* chevron */}
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Slots area */}
      {!dateSelected && (
        <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center mb-5">
          <p className="text-sm text-[#6b7280]">Select a date to see available times</p>
        </div>
      )}

      {dateSelected && loading && (
        <div>
          <p className="text-xs font-medium text-[#6b7280] mb-2 uppercase tracking-wide">Available times</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-11 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {showSlots && (
        <div>
          <p className="text-xs font-medium text-[#6b7280] mb-2 uppercase tracking-wide">
            {slots.length} time{slots.length !== 1 ? 's' : ''} available
          </p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {slots.map((slot) => (
              <button
                key={slot.start}
                type="button"
                onClick={() => onSelect(selected === slot.start ? null : slot.start)}
                className={`rounded-lg border py-2.5 px-1 text-center min-h-11 transition-colors ${
                  selected === slot.start
                    ? 'border-[#0F6E56] bg-[#E1F5EE]'
                    : 'border-gray-200 bg-white hover:border-[#0F6E56]/40'
                }`}
              >
                <p className={`text-xs font-semibold ${selected === slot.start ? 'text-[#0F6E56]' : 'text-[#1a1a1a]'}`}>
                  {getSlotTime(slot.start)}
                </p>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { onSelect(null); onContinue() }}
            className="block w-full text-center text-xs text-[#6b7280] underline underline-offset-2 mb-4 min-h-9 leading-9"
          >
            Skip — clinic will confirm my time
          </button>
        </div>
      )}

      {showEmpty && (
        <div className="rounded-xl bg-[#E1F5EE] border border-[#0F6E56]/20 p-4 mb-4 text-sm">
          <p className="font-semibold text-[#0F6E56] mb-1">No slots available on this day</p>
          <p className="text-[#6b7280] text-xs">Try a different date, or continue and the clinic will confirm your time.</p>
        </div>
      )}

      <div className="space-y-3">
        <PrimaryBtn onClick={onContinue} disabled={!dateSelected && !selected}>
          {selected ? 'Continue with selected time' : 'Continue without time'}
        </PrimaryBtn>
        <BackBtn onClick={onBack} />
      </div>
    </div>
  )
}

function ReviewStep({
  clinic,
  doctor,
  phone,
  fullName,
  age,
  gender,
  bookerRelation,
  proxyName,
  symptoms,
  timeslot,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  clinic: Clinic
  doctor: Doctor
  phone: string
  fullName: string
  age: string
  gender: string
  bookerRelation: 'self' | 'proxy'
  proxyName: string
  symptoms: string
  timeslot: string | null
  submitting: boolean
  error: string
  onBack: () => void
  onSubmit: () => void
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Doctor', value: `Dr. ${doctor.fullName}${doctor.specialty ? ` · ${doctor.specialty}` : ''}` },
    { label: 'Name', value: fullName },
    { label: 'Mobile', value: phone },
    ...(age ? [{ label: 'Age', value: age }] : []),
    ...(gender ? [{ label: 'Gender', value: gender.charAt(0).toUpperCase() + gender.slice(1) }] : []),
    { label: 'Booked for', value: bookerRelation === 'proxy' ? `${proxyName} (booking for someone else)` : 'Myself' },
    { label: 'Symptoms', value: symptoms.length > 100 ? symptoms.slice(0, 100) + '…' : symptoms },
    { label: 'Appointment time', value: timeslot ? formatReviewDate(timeslot) : 'To be confirmed by clinic' },
  ]

  return (
    <div>
      <h1
        className="text-xl font-bold text-[#1a1a1a] mb-4"
        style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}
      >
        Confirm your booking
      </h1>

      <div className="rounded-xl border border-gray-200 overflow-hidden mb-5">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`flex justify-between gap-3 px-4 py-3 ${i !== rows.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            <span className="text-xs text-[#6b7280] shrink-0 pt-0.5">{row.label}</span>
            <span className="text-sm text-[#1a1a1a] text-right">{row.value}</span>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-500 text-center mb-3 bg-red-50 rounded-lg py-2 px-3">{error}</p>
      )}

      <div className="space-y-3">
        <PrimaryBtn onClick={onSubmit} loading={submitting} disabled={submitting}>
          {submitting ? 'Booking…' : 'Confirm booking'}
        </PrimaryBtn>
        <BackBtn onClick={onBack} />
      </div>
    </div>
  )
}

function SuccessStep({
  data,
  clinic,
  doctor,
}: {
  data: SuccessData
  clinic: Clinic
  doctor: Doctor
}) {
  const gcalUrl = data.timeslot ? buildGCalUrl(data.timeslot, clinic, doctor) : null

  return (
    <div className="text-center py-2">
      {/* Checkmark */}
      <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-[#E1F5EE] flex items-center justify-center">
        <svg className="h-8 w-8 text-[#0F6E56]" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1
        className="text-2xl font-bold text-[#1a1a1a] mb-1"
        style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}
      >
        You&apos;re booked!
      </h1>
      <p className="text-sm text-[#6b7280] mb-5">Your appointment has been confirmed.</p>

      {/* Confirmation card */}
      <div className="rounded-xl border border-gray-200 text-left overflow-hidden mb-5">
        <div className="bg-[#E1F5EE] px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#0F6E56]">Appointment confirmed</span>
          <span className="text-[10px] bg-[#0F6E56] text-white rounded-full px-2 py-0.5">Confirmed</span>
        </div>
        {[
          { label: 'Doctor', value: `Dr. ${data.doctor.fullName}` },
          { label: 'Clinic', value: data.clinic.name },
          ...(data.clinic.address ? [{ label: 'Address', value: data.clinic.address }] : []),
          {
            label: 'Time',
            value: data.timeslot ? formatReviewDate(data.timeslot) : 'To be confirmed by the clinic',
          },
        ].map((row, i, arr) => (
          <div
            key={i}
            className={`flex justify-between gap-3 px-4 py-3 ${i !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            <span className="text-xs text-[#6b7280] shrink-0">{row.label}</span>
            <span className="text-sm text-[#1a1a1a] text-right">{row.value}</span>
          </div>
        ))}
      </div>

      {gcalUrl && (
        <a
          href={gcalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full rounded-lg border-2 border-[#0F6E56] text-[#0F6E56] text-sm font-semibold py-3 min-h-11 items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add to Google Calendar
        </a>
      )}
    </div>
  )
}
