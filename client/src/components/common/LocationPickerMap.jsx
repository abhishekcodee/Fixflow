import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Button } from './Button';
import './ComplaintsMap.css';

export function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  className = '',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [currentCoords, setCurrentCoords] = useState({
    lat: latitude || 28.6139,
    lng: longitude || 77.2090,
  });

  // Initialize interactive map for location picking
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = latitude || 28.6139;
    const initialLng = longitude || 77.2090;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Draggable Pin
    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
    }).addTo(map);

    marker.bindPopup('<b>Incident Location</b><br/>Drag or click anywhere on map to reposition.').openPopup();

    marker.on('dragend', function (e) {
      const position = e.target.getLatLng();
      const updated = {
        lat: parseFloat(position.lat.toFixed(6)),
        lng: parseFloat(position.lng.toFixed(6)),
      };
      setCurrentCoords(updated);
      if (onChange) {
        onChange({ latitude: updated.lat, longitude: updated.lng });
      }
    });

    // Click anywhere to reposition
    map.on('click', function (e) {
      const { lat, lng } = e.latlng;
      const updated = {
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6)),
      };
      marker.setLatLng([updated.lat, updated.lng]);
      setCurrentCoords(updated);
      if (onChange) {
        onChange({ latitude: updated.lat, longitude: updated.lng });
      }
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update pin position when latitude/longitude props change externally
  useEffect(() => {
    if (latitude && longitude && markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.panTo([latitude, longitude]);
      setCurrentCoords({ lat: latitude, lng: longitude });
    }
  }, [latitude, longitude]);

  // GPS geolocation button handler
  function handleDetectLocation() {
    if (!navigator.geolocation) {
      setDetectError('Geolocation is not supported by your browser.');
      return;
    }

    setDetecting(true);
    setDetectError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetecting(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setCurrentCoords({ lat, lng });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16);
          markerRef.current.setLatLng([lat, lng]);
          markerRef.current.openPopup();
        }

        if (onChange) {
          onChange({ latitude: lat, longitude: lng });
        }
      },
      (err) => {
        setDetecting(false);
        setDetectError(err.message || 'Unable to retrieve location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div className={`location-picker-box ${className}`.trim()}>
      <div className="location-picker-header">
        <div className="location-picker-title">
          <span>📍 Pinpoint Incident Location on Map</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleDetectLocation}
          isLoading={detecting}
          loadingText="Locating..."
        >
          📍 Use Current GPS Location
        </Button>
      </div>

      {detectError && (
        <div className="text-danger text-xs mt-1">
          {detectError}
        </div>
      )}

      <div className="location-picker-map">
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      </div>

      <div className="location-detected-bar">
        <span>
          Selected Coordinates: <strong>{currentCoords.lat}, {currentCoords.lng}</strong>
        </span>
        <span className="text-xs" style={{ color: '#475569' }}>
          (Click or drag the pin to adjust)
        </span>
      </div>
    </div>
  );
}
