import { NextResponse } from 'next/server';
import { getUsageSnapshot } from '@/lib/usageTracker';

export function GET() {
  return NextResponse.json(getUsageSnapshot());
}
