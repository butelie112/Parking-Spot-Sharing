import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.MAPBOX_ACCESS_TOKEN;

  return NextResponse.json({
    hasToken: !!token,
    tokenLength: token?.length || 0,
    tokenStartsWith: token?.substring(0, 5) || 'none',
    environment: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString()
  });
}


