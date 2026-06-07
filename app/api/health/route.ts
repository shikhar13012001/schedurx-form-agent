import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const ts = new Date().toISOString()

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'ok', ts })
  } catch {
    return NextResponse.json({ status: 'ok', db: 'error', ts })
  }
}
