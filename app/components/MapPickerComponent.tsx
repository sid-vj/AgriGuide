"use client";

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import osmtogeojson from 'osmtogeojson';

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

// Farmland Highlighter Component
function FarmlandHighlighter({ onLoadingChange }: { onLoadingChange: (loading: boolean) => void }) {
  const map = useMap();
  const [geoData, setGeoData] = useState<any>(null);
  const fetchTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchFarmlands = async () => {
    const zoom = map.getZoom();
    // Only fetch farmlands when zoomed in sufficiently to avoid massive data downloads
    if (zoom < 13) {
      setGeoData(null);
      return;
    }

    const bounds = map.getBounds();
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    // Overpass QL Query to get farmland and orchards
    const query = `
      [out:json][timeout:25];
      (
        way["landuse"="farmland"](${south},${west},${north},${east});
        relation["landuse"="farmland"](${south},${west},${north},${east});
        way["landuse"="orchard"](${south},${west},${north},${east});
        relation["landuse"="orchard"](${south},${west},${north},${east});
        way["landuse"="meadow"](${south},${west},${north},${east});
      );
      out body;
      >;
      out skel qt;
    `;

    try {
      onLoadingChange(true);
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`
      });
      
      if (!response.ok) throw new Error('Overpass API failed');
      const data = await response.json();
      
      // Convert raw OSM JSON to GeoJSON
      const geojson = osmtogeojson(data);
      setGeoData(geojson);
    } catch (err) {
      console.warn("Failed to fetch farmlands:", err);
    } finally {
      onLoadingChange(false);
    }
  };

  useMapEvents({
    moveend() {
      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
      // Debounce the fetch slightly so rapid panning doesn't spam the API
      fetchTimeout.current = setTimeout(() => {
        fetchFarmlands();
      }, 500);
    },
    zoomend() {
      if (map.getZoom() < 13) {
        setGeoData(null);
      }
    }
  });

  // Initial fetch if we start zoomed in
  useEffect(() => {
    fetchFarmlands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!geoData || !geoData.features || geoData.features.length === 0) return null;

  return (
    <GeoJSON 
      key={JSON.stringify(geoData.features.length) + map.getCenter().lat} // Force re-render when data changes
      data={geoData} 
      style={{
        color: '#d4af37', // Golden border
        weight: 1.5,
        fillColor: '#10b981', // Green fill
        fillOpacity: 0.25
      }} 
    />
  );
}

export default function MapPickerComponent({ onLocationSelect, selectedPos }: MapPickerProps) {
  const [loadingFarmlands, setLoadingFarmlands] = useState(false);

  return (
    <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
      {/* Loading Indicator for Farmlands Overlay */}
      {loadingFarmlands && (
        <div style={{
          position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'var(--panel-bg)', padding: '8px 16px', borderRadius: '20px',
          border: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600
        }}>
          <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid var(--text-secondary)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          Scanning for Farmlands...
        </div>
      )}

      <MapContainer
        center={[20.5937, 78.9629]} // Center on India roughly by default
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false} // Clean UI
      >
        <TileLayer
          // Changed to CartoDB Positron (Light mode) to match the new white & gold theme
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <LocationMarker selectedPos={selectedPos} onLocationSelect={onLocationSelect} />
        <MapController selectedPos={selectedPos} />
        <FarmlandHighlighter onLoadingChange={setLoadingFarmlands} />
      </MapContainer>
    </div>
  );
}
