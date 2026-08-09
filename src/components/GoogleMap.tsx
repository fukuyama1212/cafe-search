import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

type Station = 'all' | '渋谷' | '新宿';

interface CafeScores {
  workability: number;
  stylishness: number;
}

interface CafeFeatures {
  hasOutlet: boolean;
  hasWifi: boolean;
}

export interface Cafe {
  placeId: string;
  name: string;
  address: string;
  station: Station;
  mapPosition: { x: number; y: number };
  rating: number;
  photoUrls: string[];
  scores: CafeScores;
  features: CafeFeatures;
  isChain: boolean;
}

interface GoogleMapProps {
  likedCafes: Cafe[];
  selectedStation: Station;
}

const STATION_CENTERS: Record<Station, { lat: number; lng: number }> = {
  all: { lat: 35.66539, lng: 139.70942 },
  渋谷: { lat: 35.66283, lng: 139.70355 },
  新宿: { lat: 35.6895, lng: 139.6917 }
};

const getCenter = (selectedStation: Station) => {
  return STATION_CENTERS[selectedStation] ?? STATION_CENTERS.all;
};

const calcMarkerPosition = (cafe: Cafe) => {
  const center = STATION_CENTERS[cafe.station] ?? STATION_CENTERS.all;
  const lat = center.lat + (cafe.mapPosition.y - 50) * 0.0009;
  const lng = center.lng + (cafe.mapPosition.x - 50) * 0.0011;
  return { lat, lng };
};

export default function GoogleMap({ likedCafes, selectedStation }: GoogleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('[GoogleMap] VITE_GOOGLE_MAPS_API_KEY is not defined.');
      return;
    }
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const loader = new Loader({ apiKey, version: 'weekly' });

    loader.load().then(() => {
      const google = (window as unknown as { google?: any }).google;
      if (!google || !containerRef.current) {
        return;
      }

      mapRef.current = new google.maps.Map(containerRef.current, {
        center: getCenter(selectedStation),
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false
      });
      infoWindowRef.current = new google.maps.InfoWindow();
    }).catch((error: unknown) => {
      console.error('[GoogleMap] failed to load Google Maps', error);
    });
  }, []);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }
    const center = getCenter(selectedStation);
    mapRef.current.panTo(center);
  }, [selectedStation]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    markersRef.current.forEach(marker => {
      if (marker && typeof marker.setMap === 'function') {
        marker.setMap(null);
      }
    });
    markersRef.current = [];

    likedCafes.forEach(cafe => {
      const position = calcMarkerPosition(cafe);
      const google = (window as unknown as { google?: any }).google;
      if (!google || !mapRef.current) {
        return;
      }

      const marker = new google.maps.Marker({
        map: mapRef.current,
        position,
        title: cafe.name
      });

      marker.addListener('click', () => {
        if (!infoWindowRef.current) {
          infoWindowRef.current = new google.maps.InfoWindow();
        }

        infoWindowRef.current.setContent(
          `<div style="max-width:220px;font-family:system-ui,sans-serif;"><strong>${cafe.name}</strong><div style="font-size:0.9rem;color:#555;">${cafe.address}</div></div>`
        );
        infoWindowRef.current.open({ anchor: marker, map: mapRef.current });
      });

      markersRef.current.push(marker);
    });
  }, [likedCafes]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
