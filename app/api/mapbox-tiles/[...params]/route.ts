import { NextRequest, NextResponse } from 'next/server';

/**
 * Mapbox Tile Proxy Route
 * 
 * This route proxies requests to Mapbox tile servers to keep the access token secure.
 * Instead of exposing the Mapbox token in the frontend, all tile requests go through
 * this backend route which adds the token server-side.
 * 
 * URL Format: /api/mapbox-tiles/{style}/{z}/{x}/{y}
 * Example: /api/mapbox-tiles/streets-v12/12/1201/1535
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathParams = resolvedParams.params;

    // Validate parameters
    if (!pathParams || pathParams.length !== 4) {
      return NextResponse.json(
        { error: 'Invalid tile request format. Expected: /api/mapbox-tiles/{style}/{z}/{x}/{y}' },
        { status: 400 }
      );
    }

    const [style, z, x, y] = pathParams;

    // Validate style (basic whitelist)
    const allowedStyles = [
      'streets-v12',
      'satellite-v9',
      'outdoors-v12',
      'light-v11',
      'dark-v11'
    ];

    if (!allowedStyles.includes(style)) {
      return NextResponse.json(
        { error: 'Invalid map style' },
        { status: 400 }
      );
    }

    // Validate numeric parameters
    const zoom = parseInt(z);
    const xCoord = parseInt(x);
    const yCoord = parseInt(y);

    if (isNaN(zoom) || isNaN(xCoord) || isNaN(yCoord)) {
      return NextResponse.json(
        { error: 'Invalid tile coordinates' },
        { status: 400 }
      );
    }

    if (zoom < 0 || zoom > 22) {
      return NextResponse.json(
        { error: 'Invalid zoom level. Must be between 0 and 22' },
        { status: 400 }
      );
    }

    // Get Mapbox access token from environment (server-side only)
    const accessToken = process.env.MAPBOX_ACCESS_TOKEN;

    if (!accessToken) {
      console.error('MAPBOX_ACCESS_TOKEN environment variable is not set');
      console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('MAPBOX') || key.includes('NEXT')));
      return NextResponse.json(
        { error: 'Map service configuration error' },
        { status: 500 }
      );
    }

    // Construct the Mapbox tile URL
    const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/${zoom}/${xCoord}/${yCoord}?access_token=${accessToken}`;

    // Fetch the tile from Mapbox
    const response = await fetch(mapboxUrl, {
      headers: {
        'User-Agent': 'Parkezz-Tile-Proxy/1.0',
      },
      // Cache tiles for performance
      next: { revalidate: 86400 } // Cache for 24 hours
    });

    if (!response.ok) {
      console.error(`Mapbox tile fetch failed: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch map tile' },
        { status: response.status }
      );
    }

    // Get the tile image data
    const tileData = await response.arrayBuffer();

    // Return the tile with proper headers
    return new NextResponse(tileData, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=86400', // Cache in browser for 24 hours
        'Access-Control-Allow-Origin': '*', // Allow cross-origin requests
        'Access-Control-Allow-Methods': 'GET',
      },
    });

  } catch (error) {
    console.error('Error in Mapbox tile proxy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

