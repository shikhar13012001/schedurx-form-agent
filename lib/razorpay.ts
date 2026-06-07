const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

function isConfigured(): boolean {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`
}

export async function createOrder(
  amountInr: number,
  appointmentId: string
): Promise<{ orderId: string }> {
  if (!isConfigured()) {
    console.warn('[razorpay] RAZORPAY_KEY_ID not set — returning mock order')
    return { orderId: `mock_order_${appointmentId}` }
  }

  try {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        amount: amountInr * 100, // paise
        currency: 'INR',
        receipt: appointmentId,
        notes: { appointmentId },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.warn('[razorpay] createOrder failed:', text)
      return { orderId: `error_order_${appointmentId}` }
    }

    const data = await res.json()
    return { orderId: data.id }
  } catch (err) {
    console.warn('[razorpay] createOrder error:', err)
    return { orderId: `error_order_${appointmentId}` }
  }
}

export async function createPaymentLink(
  amountInr: number,
  appointmentId: string,
  customerPhone: string
): Promise<{ shortUrl: string }> {
  if (!isConfigured()) {
    console.warn('[razorpay] RAZORPAY_KEY_ID not set — returning mock payment link')
    return { shortUrl: `https://rzp.io/mock/${appointmentId}` }
  }

  try {
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        amount: amountInr * 100,
        currency: 'INR',
        description: `Appointment ${appointmentId}`,
        customer: {
          contact: `+91${customerPhone}`,
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { appointmentId },
        callback_url: process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`
          : undefined,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.warn('[razorpay] createPaymentLink failed:', text)
      return { shortUrl: `https://rzp.io/error/${appointmentId}` }
    }

    const data = await res.json()
    return { shortUrl: data.short_url }
  } catch (err) {
    console.warn('[razorpay] createPaymentLink error:', err)
    return { shortUrl: `https://rzp.io/error/${appointmentId}` }
  }
}
