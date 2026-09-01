import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { readData } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

/**
 * Streams the whole file back as a download. This is the only way the raw data
 * ever leaves the server, and it is an explicit, user-initiated action —
 * `data/` itself is outside `public/` and is never served statically.
 */
export async function GET() {
  return handle(async () => {
    const data = await readData();
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="finance-export-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
