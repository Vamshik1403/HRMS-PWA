"use client";
// Loaded dynamically (no SSR) — leaflet requires window
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's broken default icon paths when bundled with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface AttendanceMapProps {
  latitude: number;
  longitude: number;
  accuracy?: number;
  popupText?: string;
}

export default function AttendanceMap({
  latitude,
  longitude,
  accuracy,
  popupText,
}: AttendanceMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Remove existing map instance before re-initialising
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: 16,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([latitude, longitude]).addTo(map);

    if (popupText) {
      marker.bindPopup(popupText, { maxWidth: 280 }).openPopup();
    }

    // Draw accuracy circle if provided
    if (accuracy && accuracy > 0) {
      L.circle([latitude, longitude], {
        radius: accuracy,
        color: "#4f46e5",
        fillColor: "#4f46e5",
        fillOpacity: 0.08,
        weight: 1.5,
      }).addTo(map);
    }

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude, accuracy, popupText]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%", borderRadius: "inherit" }} />;
}
