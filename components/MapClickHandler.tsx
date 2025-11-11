'use client';

import { useMapEvents, useMap } from 'react-leaflet';
import { useEffect } from 'react';

interface MapClickHandlerProps {
  onAddSpotAtLocation?: (lat: number, lng: number) => void;
  selectingLocation?: boolean;
}

export default function MapClickHandler({ onAddSpotAtLocation, selectingLocation }: MapClickHandlerProps) {
  useMapEvents({
    click: (e) => {
      if (selectingLocation && onAddSpotAtLocation) {
        console.log('Pin placement: Map clicked at', { lat: e.latlng.lat, lng: e.latlng.lng });
        onAddSpotAtLocation(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return null;
}

// Component to programmatically control map center and zoom
interface MapControllerProps {
  center: [number, number];
  zoom: number;
  mapInstance?: any;
}

export function MapController({ center, zoom, mapInstance }: MapControllerProps) {
  const hookMap = useMap();

  useEffect(() => {
    const map = mapInstance || hookMap;

    // Only proceed if we have a valid map instance
    if (!map) {
      console.log('MapController: No map instance available yet');
      return;
    }

    // Check if map is properly initialized
    if (!map._loaded || !map._container) {
      console.log('MapController: Map not fully loaded yet');
      return;
    }

    // Validate center coordinates
    if (!center || !Array.isArray(center) || center.length !== 2 ||
        typeof center[0] !== 'number' || typeof center[1] !== 'number' ||
        isNaN(center[0]) || isNaN(center[1])) {
      console.warn('MapController: Invalid center coordinates:', center);
      return;
    }

    // Validate zoom
    if (typeof zoom !== 'number' || isNaN(zoom) || zoom < 1 || zoom > 22) {
      console.warn('MapController: Invalid zoom level:', zoom);
      return;
    }

    console.log('MapController: Centering map on:', center, 'zoom:', zoom);

    try {
      // Use setView for reliable centering with smooth animation
      // Add a small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        if (map._loaded && map._container) {
      map.setView(center, zoom, {
        animate: true,
        duration: 1.5,
        easeLinearity: 0.25
      });
      console.log('MapController: Map view set successfully');
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    } catch (error) {
      console.error('MapController: Error setting map view:', error);
    }
  }, [center, zoom, mapInstance, hookMap]);

  return null;
}
