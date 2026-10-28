import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { RefreshIcon } from './Icons';
import { Button } from './Button';
import './ComplaintsMap.css';

// Fix default leaflet asset paths if needed
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Category & Status Icon SVG SVGs for Markers
function getPinSvg(priority) {
  if (priority === 'urgent') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }
  if (priority === 'high') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  }
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
}

export function ComplaintsMap({
  complaints = [],
  title = 'Facility Incident Telemetry Map',
  subtitle = 'Real-time geospatial visualization of reported maintenance complaints across campus',
  onRefresh,
  isRefreshing = false,
  className = '',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [activeFilter, setActiveFilter] = useState('all');

  // Filter complaints based on active pill
  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      if (activeFilter === 'urgent_high') {
        return item.priority === 'urgent' || item.priority === 'high';
      }
      if (activeFilter === 'in_progress') {
        return ['in_progress', 'assigned'].includes(item.status);
      }
      if (activeFilter === 'resolved') {
        return ['resolved', 'closed'].includes(item.status);
      }
      return true;
    });
  }, [complaints, activeFilter]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Default center (Facility Campus)
    const initialCenter = [28.6139, 77.2090];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 14,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    // Standard high-reliability OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = markersLayer;

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
      markersLayerRef.current = null;
    };
  }, []);

  // Update Markers when complaints or filter changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const boundsPoints = [];

    filteredComplaints.forEach((item) => {
      let lat = item.location?.latitude;
      let lng = item.location?.longitude;

      // Fallback coordinate generation for complaints without explicit lat/lng
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        const baseLat = 28.6139;
        const baseLng = 77.2090;
        const seed = `${item.location?.building || 'Main'}-${item.location?.room || item._id || '101'}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          hash = (hash << 5) - hash + seed.charCodeAt(i);
          hash |= 0;
        }
        const offsetLat = ((Math.abs(hash) % 80) - 40) * 0.00015;
        const offsetLng = (((Math.abs(hash) >> 3) % 80) - 40) * 0.00015;
        lat = parseFloat((baseLat + offsetLat).toFixed(6));
        lng = parseFloat((baseLng + offsetLng).toFixed(6));
      }

      boundsPoints.push([lat, lng]);

      // Priority class
      let pinClass = 'pin--medium';
      if (['resolved', 'closed'].includes(item.status)) {
        pinClass = 'pin--resolved';
      } else if (item.priority === 'urgent') {
        pinClass = 'pin--urgent';
      } else if (item.priority === 'high') {
        pinClass = 'pin--high';
      } else if (item.priority === 'low') {
        pinClass = 'pin--low';
      }

      const iconHtml = `
        <div class="map-pin-inner">
          <div class="map-pin-icon">
            ${getPinSvg(item.priority)}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: `custom-map-pin ${pinClass}`,
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const popupHtml = `
        <div class="map-popup-card">
          <div class="map-popup-header">
            <span class="map-popup-ticket">${item.complaintNumber || 'TICKET'}</span>
            <span class="cat-pill cat-pill--${item.category || 'other'}">${(item.category || 'other').replace('_', ' ')}</span>
          </div>
          <div class="map-popup-title">${item.title}</div>
          <div class="map-popup-location">
            📍 ${item.location?.building || 'Facility'}, Fl ${item.location?.floor || 1}, Rm ${item.location?.room || '—'}
          </div>
          <div class="map-popup-footer">
            <span class="text-xs" style="text-transform: capitalize; font-weight: 600; color: #475569;">
              Status: ${item.status?.replace('_', ' ')}
            </span>
            <a href="/complaints/${item._id || item.id}" class="map-popup-link">
              View Ticket →
            </a>
          </div>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: customIcon });
      marker.bindPopup(popupHtml, { autoPan: true });
      marker.on('click', () => {
        marker.openPopup();
      });
      markersLayer.addLayer(marker);

      // Auto open popup if single incident
      if (filteredComplaints.length === 1) {
        setTimeout(() => {
          marker.openPopup();
        }, 300);
      }
    });

    // Auto-fit bounds if markers exist
    if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 16);
    } else if (boundsPoints.length > 1) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [filteredComplaints]);

  // Center / Fit to all markers
  function handleFitAll() {
    const map = mapInstanceRef.current;
    if (!map || filteredComplaints.length === 0) return;

    const points = filteredComplaints.map((item) => {
      const lat = item.location?.latitude || 28.6139;
      const lng = item.location?.longitude || 77.2090;
      return [lat, lng];
    });

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
    }
  }

  return (
    <div className={`complaints-map-card ${className}`.trim()}>
      <div className="map-card-header">
        <div className="map-card-title-group">
          <div className="map-card-title">
            <span>{title}</span>
            <span className="map-live-badge">
              <span className="map-live-dot" />
              Live Sync
            </span>
          </div>
          <span className="map-card-subtitle">
            {subtitle}
          </span>
        </div>

        <div className="map-card-controls">
          <div className="map-filter-pills" role="tablist" aria-label="Map Filters">
            <button
              type="button"
              className={`map-pill ${activeFilter === 'all' ? 'map-pill--active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All ({complaints.length})
            </button>
            <button
              type="button"
              className={`map-pill ${activeFilter === 'urgent_high' ? 'map-pill--active' : ''}`}
              onClick={() => setActiveFilter('urgent_high')}
            >
              High / Urgent
            </button>
            <button
              type="button"
              className={`map-pill ${activeFilter === 'in_progress' ? 'map-pill--active' : ''}`}
              onClick={() => setActiveFilter('in_progress')}
            >
              Active
            </button>
            <button
              type="button"
              className={`map-pill ${activeFilter === 'resolved' ? 'map-pill--active' : ''}`}
              onClick={() => setActiveFilter('resolved')}
            >
              Resolved
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleFitAll}
            title="Recenter and zoom to show all active pins"
          >
            Fit Markers
          </Button>

          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              isLoading={isRefreshing}
              className="btn-with-icon"
              title="Poll latest incidents from server"
            >
              <RefreshIcon size={13} />
              <span>Refresh Map</span>
            </Button>
          )}
        </div>
      </div>

      <div className="map-canvas-container">
        <div ref={mapContainerRef} className="map-canvas-inner" />

        {filteredComplaints.length === 0 && (
          <div className="map-empty-overlay">
            <p className="font-semibold text-sm">No Incidents Plotted</p>
            <p className="text-xs text-muted mt-1">
              There are currently no maintenance complaints matching this filter.
            </p>
          </div>
        )}
      </div>

      <div className="map-card-footer">
        <div className="map-legend">
          <span className="font-semibold text-muted">Legend:</span>
          <div className="map-legend-item">
            <span className="map-legend-dot legend--urgent" />
            <span>Urgent (Pulsing)</span>
          </div>
          <div className="map-legend-item">
            <span className="map-legend-dot legend--high" />
            <span>High Priority</span>
          </div>
          <div className="map-legend-item">
            <span className="map-legend-dot legend--medium" />
            <span>Standard Active</span>
          </div>
          <div className="map-legend-item">
            <span className="map-legend-dot legend--resolved" />
            <span>Resolved</span>
          </div>
        </div>

        <div className="map-meta-count">
          Showing <strong>{filteredComplaints.length}</strong> location{filteredComplaints.length === 1 ? '' : 's'} on map
        </div>
      </div>
    </div>
  );
}
