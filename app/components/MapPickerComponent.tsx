"use client";

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in leaflet with Next.js
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapPickerProps {
  onLocationSelect: (lat: number, lon: number) => void;
  selectedPos: [number, number] | null;
}

// Component to handle map clicks
function LocationMarker({ selectedPos, onLocationSelect }: MapPickerProps) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return selectedPos === null ? null : (
    <Marker position={selectedPos} icon={icon} />
  );
}

// Component to fly the map to a new location when selectedPos changes externally
function MapController({ selectedPos }: { selectedPos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedPos) {
      map.flyTo(selectedPos, 12, { duration: 1.5 });
    }
  }, [selectedPos, map]);
  return null;
}

export default function MapPickerComponent({ onLocationSelect, selectedPos }: MapPickerProps) {
  return (
    <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
      <MapContainer
        center={[20.5937, 78.9629]} // Center on India roughly by default
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false} // Clean UI
      >
        <TileLayer
          // Using a dark/cool aesthetic map tile (CartoDB Dark Matter)
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <LocationMarker selectedPos={selectedPos} onLocationSelect={onLocationSelect} />
        <MapController selectedPos={selectedPos} />
      </MapContainer>
    </div>
  );
}
