'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as api from '@/lib/api-client'

// ─── Types ──────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'CLINIC_NOT_FOUND' | 'CLINIC_LOAD_ERROR'

export interface Clinic {
  id: string
  name: string
  phone: string | null
  address: string | null
  city: string | null
  logoUrl: string | null
}

export interface Doctor {
  id: string
  fullName: string
  specialty: string | null
  avatarUrl: string | null
}

export interface Slot {
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

export function formatReviewDate(iso: string): string {
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
    <div className="flex items-center justify-center gap-1.5 border-b border-sx-stone-100 bg-sx-white px-4 py-3">
      {[1, 2, 3, 4, 5].map((s) => (
        <div
          key={s}
          className={
            s === currentStep
              ? 'h-2 w-6 rounded-full bg-sx-orange transition-all'
              : s < currentStep
              ? 'h-2 w-2 rounded-full bg-sx-orange'
              : 'h-2 w-2 rounded-full bg-sx-stone-200'
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
      <label className="block text-sm font-medium text-sx-charcoal">
        {label}
        {required && <span className="ml-0.5 text-sx-orange">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-sx-muted">{hint}</p>}
    </div>
  )
}

const inputClass =
  'w-full rounded-[22px] border border-sx-stone-200 bg-sx-white px-4 py-2.5 text-sm text-sx-charcoal placeholder:text-sx-stone focus:outline-none focus:ring-2 focus:ring-sx-orange/30 focus:border-sx-orange min-h-11'

// Only the true climactic action of a given screen (Confirm booking, Pay
// now) earns the vivid orange treatment — ScheduRx Master Brand Soul,
// section 17: "Only one action per composition should usually earn the
// vivid orange treatment." Every intermediate "Continue" through the
// wizard uses the calmer charcoal pill instead.
export function PrimaryBtn({
  onClick,
  disabled,
  children,
  loading,
  variant = 'charcoal',
}: {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  loading?: boolean
  variant?: 'charcoal' | 'orange'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
        variant === 'orange' ? 'bg-sx-orange hover:bg-sx-orange-deep' : 'bg-sx-charcoal hover:bg-sx-charcoal/90'
      }`}
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

export function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center justify-center gap-1.5 rounded-full bg-sx-stone-50 px-6 py-3.5 text-sm font-medium text-sx-charcoal transition-colors hover:bg-sx-stone-100"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export interface IntakeFormProps {
  clinicId: string
  phone: string
  preSelectedDoctorId?: string
  // Opaque missed-call-attribution token forwarded as-is on booking — see
  // app/[clinicId]/[idOrPhone]/page.tsx's own comment. Not read or
  // validated here; the backend does that.
  missedCallToken?: string
}

export default function IntakeForm({ clinicId, phone, preSelectedDoctorId, missedCallToken }: IntakeFormProps) {
  const router = useRouter()
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

  // Step 0 — fetch clinic data on mount. A real 404 (bad/unknown clinic id)
  // is genuinely "not found"; any other failure (backend momentarily down,
  // network blip) is transient — showing the same dead-end there would tell
  // a patient to "contact the clinic" over something a retry would fix.
  const loadClinic = useCallback(() => {
    api
      .getClinic(clinicId)
      .then((data) => {
        if (!data.doctors || data.doctors.length === 0) {
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
      .catch((err) => setStep(err instanceof api.ApiError && err.status === 404 ? 'CLINIC_NOT_FOUND' : 'CLINIC_LOAD_ERROR'))
  }, [clinicId, preSelectedDoctorId])

  useEffect(() => {
    loadClinic()
  }, [loadClinic])

  // Step 4 — fetch slots for a specific date when the user picks one
  const fetchSlotsForDate = useCallback((dateStr: string) => {
    if (!selectedDoctor || !dateStr) return
    setSlotsLoading(true)
    setSlots([])
    setTimeslot(null)
    api
      .getSlots(clinicId, selectedDoctor.id, dateStr)
      .then((data) => {
        setSlots(data.slots)
        setSchedulerConfigured(data.schedulerConfigured)
      })
      .catch(() => { setSlots([]); setSchedulerConfigured(false) })
      .finally(() => setSlotsLoading(false))
  }, [clinicId, selectedDoctor])

  // Always land on step 4 with a blank date/slot pick, whether arriving
  // forward (from symptoms) or back (from the review step).
  function goToStep4() {
    setSelectedDate('')
    setSlots([])
    setTimeslot(null)
    setStep(4)
  }

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
    if (!clinic || !selectedDoctor || !timeslot) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const result = await api.bookAppointment({
        clinicId,
        doctorId: selectedDoctor.id,
        missedCallToken,
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
          timeslot,
        },
      })

      // This clinic requires a token payment before the booking is final —
      // no Appointment exists yet, just a held slot. Send the patient to pay,
      // rather than showing a confirmation for a booking that isn't real yet.
      if (result.kind === 'pending_payment') {
        router.push(`/${clinicId}/pay/${result.pendingBookingId}`)
        return
      }

      // The backend only returns appointment identifiers, not doctor/clinic
      // details — build the confirmation view from state already in hand.
      setSuccessData({
        appointmentId: result.appointmentId,
        doctor: { fullName: selectedDoctor.fullName, specialty: selectedDoctor.specialty },
        clinic: { name: clinic.name, address: clinic.address },
        timeslot: result.timeslot,
      })
      setStep(6)
    } catch (err) {
      setSubmitError(err instanceof api.ApiError ? err.message : 'Network error. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  // ─── Header ────────────────────────────────────────────────────────────────

  const headerSubtitle =
    step !== 0 && step !== 'CLINIC_NOT_FOUND' && step !== 'CLINIC_LOAD_ERROR' && step !== 6 && selectedDoctor
      ? `Dr. ${selectedDoctor.fullName}`
      : step === 6 && successData
      ? `Dr. ${successData.doctor.fullName}`
      : null

  const showProgress =
    typeof step === 'number' && step >= 1 && step <= 5

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-sx-canvas px-3 py-4">
      <div className="mx-auto max-w-[440px]">
        {/* Card */}
        <div className="overflow-hidden rounded-[32px] shadow-[0_1px_2px_rgba(24,24,24,0.02),0_16px_44px_rgba(24,24,24,0.07)]">
          {/* Charcoal header */}
          <div className="bg-sx-charcoal px-5 py-4 text-white">
            <p className="text-base font-medium leading-tight tracking-[-0.01em]">
              {clinic?.name ?? 'ScheduRx'}
            </p>
            {headerSubtitle && (
              <p className="mt-0.5 text-xs text-white/60">{headerSubtitle}</p>
            )}
          </div>

          {/* Progress dots */}
          {showProgress && <ProgressDots currentStep={step as number} />}

          {/* Step content */}
          <div className="bg-sx-white px-5 pb-6 pt-5">
            {step === 0 && <LoadingStep />}
            {step === 'CLINIC_NOT_FOUND' && <ClinicNotFoundStep />}
            {step === 'CLINIC_LOAD_ERROR' && (
              <ClinicLoadErrorStep
                onRetry={() => {
                  setStep(0)
                  loadClinic()
                }}
              />
            )}
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
                  if (validateStep3()) { setErrors({}); goToStep4() }
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
                onBack={goToStep4}
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
      <svg className="h-8 w-8 animate-spin text-sx-orange" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  )
}

function ClinicNotFoundStep() {
  return (
    <div className="py-8 text-center">
      <p className="mb-2 text-lg font-medium text-sx-charcoal">Clinic not found</p>
      <p className="text-sm text-sx-muted">Please check your link or contact the clinic.</p>
    </div>
  )
}

function ClinicLoadErrorStep({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-8 text-center">
      <p className="mb-2 text-lg font-medium text-sx-charcoal">Couldn&apos;t load booking page</p>
      <p className="mb-4 text-sm text-sx-muted">Something went wrong on our end. Please try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-sx-charcoal px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sx-charcoal/90"
      >
        Try again
      </button>
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
      <h1 className="mb-1 text-xl font-medium tracking-[-0.02em] text-sx-charcoal">
        Who would you like to see?
      </h1>
      <p className="mb-4 text-sm text-sx-muted">Select a doctor to continue</p>

      <div className="mb-5 space-y-3">
        {doctors.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => onSelect(doc)}
            className={`flex min-h-[64px] w-full items-center gap-3 rounded-[26px] border p-3 text-left transition-colors ${
              selected?.id === doc.id
                ? 'border-sx-orange bg-sx-orange-tint'
                : 'border-sx-stone-200 bg-sx-white'
            }`}
          >
            {/* Avatar */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sx-stone-100">
              {doc.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.avatarUrl} alt={doc.fullName} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-sx-charcoal">{getInitials(doc.fullName)}</span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-sx-charcoal">Dr. {doc.fullName}</p>
              {doc.specialty && <p className="mt-0.5 text-xs text-sx-muted">{doc.specialty}</p>}
            </div>
            {selected?.id === doc.id && (
              <div className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sx-orange">
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
      <h1 className="mb-4 text-xl font-medium tracking-[-0.02em] text-sx-charcoal">
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
          {errors.fullName && <p className="mt-1 text-xs text-sx-danger">{errors.fullName}</p>}
        </InputField>

        <InputField
          label="Mobile number"
          hint="Wrong number? Ask the clinic to resend your booking link."
        >
          <div className="flex min-h-11 items-center rounded-[22px] border border-sx-stone-200 bg-sx-stone-50 px-4 py-2.5 text-sm text-sx-charcoal">
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
          <div className="flex overflow-hidden rounded-[22px] border border-sx-stone-200">
            {['Male', 'Female', 'Other'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(gender === g.toLowerCase() ? '' : g.toLowerCase())}
                className={`min-h-11 flex-1 py-2.5 text-sm font-medium transition-colors ${
                  gender === g.toLowerCase()
                    ? 'bg-sx-charcoal text-white'
                    : 'bg-sx-white text-sx-muted'
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
              <label key={v} className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="bookerRelation"
                  checked={bookerRelation === v}
                  onChange={() => setBookerRelation(v)}
                  className="h-4 w-4 accent-sx-orange"
                />
                <span className="text-sm text-sx-charcoal">
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
            {errors.proxyName && <p className="mt-1 text-xs text-sx-danger">{errors.proxyName}</p>}
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
      <h1 className="mb-4 text-xl font-medium tracking-[-0.02em] text-sx-charcoal">
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
              className="w-full resize-none rounded-[22px] border border-sx-stone-200 bg-sx-white px-4 py-2.5 text-sm text-sx-charcoal placeholder:text-sx-stone focus:outline-none focus:ring-2 focus:ring-sx-orange/30 focus:border-sx-orange"
            />
            <span className="absolute bottom-2 right-3 text-xs text-sx-muted">
              {symptoms.length}/500
            </span>
          </div>
          {errors.symptoms && <p className="mt-1 text-xs text-sx-danger">{errors.symptoms}</p>}
        </InputField>

        <InputField label="Additional notes (optional)">
          <div className="relative">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 300))}
              placeholder="Any additional information for the doctor..."
              rows={3}
              className="w-full resize-none rounded-[22px] border border-sx-stone-200 bg-sx-white px-4 py-2.5 text-sm text-sx-charcoal placeholder:text-sx-stone focus:outline-none focus:ring-2 focus:ring-sx-orange/30 focus:border-sx-orange"
            />
            <span className="absolute bottom-2 right-3 text-xs text-sx-muted">
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

export function SlotStep({
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
      <h1 className="mb-0.5 text-xl font-medium tracking-[-0.02em] text-sx-charcoal">
        Choose a time
      </h1>
      <p className="mb-5 text-sm text-sx-muted">With Dr. {doctor.fullName}</p>

      {/* Date dropdown */}
      <div className="mb-5">
        <label className="mb-1.5 block text-sm font-medium text-sx-charcoal">
          Select date <span className="text-sx-orange">*</span>
        </label>
        <div className="relative">
          <select
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="min-h-11 w-full appearance-none rounded-[22px] border border-sx-stone-200 bg-sx-white px-4 py-2.5 pr-9 text-sm text-sx-charcoal focus:outline-none focus:ring-2 focus:ring-sx-orange/30 focus:border-sx-orange"
          >
            <option value="">— Pick a date —</option>
            {dates.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {/* chevron */}
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sx-muted">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Slots area */}
      {!dateSelected && (
        <div className="mb-5 rounded-[22px] border border-dashed border-sx-stone-200 p-5 text-center">
          <p className="text-sm text-sx-muted">Select a date to see available times</p>
        </div>
      )}

      {dateSelected && loading && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sx-muted">Available times</p>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-[16px] bg-sx-stone-50" />
            ))}
          </div>
        </div>
      )}

      {showSlots && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sx-muted">
            {slots.length} time{slots.length !== 1 ? 's' : ''} available
          </p>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {slots.map((slot) => (
              <button
                key={slot.start}
                type="button"
                onClick={() => onSelect(selected === slot.start ? null : slot.start)}
                className={`min-h-11 rounded-[16px] border px-1 py-2.5 text-center transition-colors ${
                  selected === slot.start
                    ? 'border-sx-orange bg-sx-orange-tint'
                    : 'border-sx-stone-200 bg-sx-white hover:border-sx-orange/40'
                }`}
              >
                <p className={`text-xs font-semibold ${selected === slot.start ? 'text-sx-orange' : 'text-sx-charcoal'}`}>
                  {getSlotTime(slot.start)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {showEmpty && (
        <div className="mb-4 rounded-[22px] border border-sx-orange/20 bg-sx-orange-tint p-4 text-sm">
          <p className="mb-1 font-medium text-sx-orange-deep">No slots available on this day</p>
          <p className="text-xs text-sx-muted">Please try a different date.</p>
        </div>
      )}

      <div className="space-y-3">
        <PrimaryBtn onClick={onContinue} disabled={!selected}>
          Continue with selected time
        </PrimaryBtn>
        <BackBtn onClick={onBack} />
      </div>
    </div>
  )
}

function ReviewStep({
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
      <h1 className="mb-4 text-xl font-medium tracking-[-0.02em] text-sx-charcoal">
        Confirm your booking
      </h1>

      <div className="mb-5 overflow-hidden rounded-[22px] border border-sx-stone-100">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`flex justify-between gap-3 px-4 py-3 ${i !== rows.length - 1 ? 'border-b border-sx-stone-100' : ''}`}
          >
            <span className="shrink-0 pt-0.5 text-xs text-sx-muted">{row.label}</span>
            <span className="text-right text-sm text-sx-charcoal">{row.value}</span>
          </div>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-[16px] bg-sx-danger-soft px-3 py-2 text-center text-xs text-sx-danger">{error}</p>
      )}

      <div className="space-y-3">
        <PrimaryBtn onClick={onSubmit} loading={submitting} disabled={submitting} variant="orange">
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
    <div className="py-2 text-center">
      {/* Checkmark — the one dominant, celebratory moment of this screen */}
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sx-orange-tint">
        <svg className="h-8 w-8 text-sx-orange" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="mb-1 text-2xl font-medium tracking-[-0.02em] text-sx-charcoal">
        You&apos;re booked!
      </h1>
      <p className="mb-5 text-sm text-sx-muted">Your appointment has been confirmed.</p>

      {/* Confirmation card */}
      <div className="mb-5 overflow-hidden rounded-[22px] border border-sx-stone-100 text-left">
        <div className="flex items-center justify-between bg-sx-orange-tint px-4 py-2.5">
          <span className="text-xs font-semibold text-sx-orange-deep">Appointment confirmed</span>
          <span className="rounded-full bg-sx-orange px-2 py-0.5 text-[10px] text-white">Confirmed</span>
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
            className={`flex justify-between gap-3 px-4 py-3 ${i !== arr.length - 1 ? 'border-b border-sx-stone-100' : ''}`}
          >
            <span className="shrink-0 text-xs text-sx-muted">{row.label}</span>
            <span className="text-right text-sm text-sx-charcoal">{row.value}</span>
          </div>
        ))}
      </div>

      {gcalUrl && (
        <a
          href={gcalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-sx-stone-200 bg-sx-stone-50 py-3 text-sm font-medium text-sx-charcoal transition-colors hover:bg-sx-stone-100"
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
