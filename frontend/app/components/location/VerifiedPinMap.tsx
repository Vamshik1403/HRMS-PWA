"use client";

import { useEffect, useRef, useState } from "react";

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || "";

type MoveHandler = (latitude: number, longitude: number) => void;

function loadGoogleMaps(): Promise<void> {
  if (!BROWSER_KEY) return Promise.reject(new Error("missing"));
  const w = window as Window & { google?: any; __openhrmMaps?: Promise<void> };
  if (w.google?.maps) return Promise.resolve();
  if (!w.__openhrmMaps) {
    w.__openhrmMaps = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(BROWSER_KEY)}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps failed to load"));
      document.head.appendChild(script);
    });
  }
  return w.__openhrmMaps;
}

export default function VerifiedPinMap({
  latitude,
  longitude,
  focus,
  onMove,
}: {
  latitude: number;
  longitude: number;
  focus: number;
  onMove: MoveHandler;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const [missingKey, setMissingKey] = useState(!BROWSER_KEY);

  useEffect(() => {
    if (!BROWSER_KEY || !containerRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const google = (window as Window & { google?: any }).google;
        const center = { lat: latitude, lng: longitude };
        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom: 17,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const marker = new google.maps.Marker({ position: center, map, draggable: true });
        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          onMoveRef.current(pos.lat(), pos.lng());
        });
        mapRef.current = map;
        markerRef.current = marker;
      })
      .catch(() => {
        if (!cancelled) setMissingKey(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const pos = { lat: latitude, lng: longitude };
    markerRef.current.setPosition(pos);
    mapRef.current.panTo(pos);
    if (focus) mapRef.current.setZoom(17);
  }, [latitude, longitude, focus]);

  if (missingKey) {
    return (
      <p className="text-xs text-gray-500">
        Google map key is not set. Coordinates can still be saved. Add a referrer-restricted browser key to show this pin on Google Maps.
      </p>
    );
  }

  return <div ref={containerRef} style={{ height: 220, width: "100%", borderRadius: 12 }} />;
}
