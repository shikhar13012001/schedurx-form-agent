export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !from) {
    console.warn('[twilio] TWILIO_ACCOUNT_SID not set — skipping WhatsApp send')
    return
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const toWhatsapp = to.startsWith('whatsapp:') ? to : `whatsapp:+91${to}`
  const fromWhatsapp = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`

  const params = new URLSearchParams({
    To: toWhatsapp,
    From: fromWhatsapp,
    Body: body,
  })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      console.warn('[twilio] sendWhatsApp failed:', text)
    }
  } catch (err) {
    console.warn('[twilio] sendWhatsApp error:', err)
  }
}
