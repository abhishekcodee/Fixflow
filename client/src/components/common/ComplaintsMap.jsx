import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { RefreshIcon, CrosshairIcon, SearchIcon, MapPinIcon } from './Icons';
import { Button } from './Button';
import {
  calculateDistanceKm,
  formatDistance,
  getOptimalZoomForRadius,
  isValidCoordinate,
} from '../../utils/geo';
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

// Fallback campus coordinates (New Delhi facilities hub)
const DEFAULT_CENTER = [28.6139, 77.2090];
const RADIUS_OPTIONS = [1, 2, 5, 10];
const ADMIN_RADIUS_OPTIONS = [1, 2, 5, 10, 25, 50];

export function ComplaintsMap({
  complaints = [],
  title = 'Facility Incident Telemetry Map',
  subtitle = 'Real-time geospatial tracking & permitted service zone',
  onRefresh,
  isRefreshing = false,
  className = '',
  onNearbySearch,
  userRole = 'user',
  initialRadius = 5,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const userLayerRef = useRef(null);
  const watchIdRef = useRef(null);
  const hasInitiallyCenteredRef = useRef(false);

  // User Live Geolocation State
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | detecting | active | denied | unavailable | timeout
  const [serviceRadius, setServiceRadius] = useState(initialRadius);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isCenteredOnUser, setIsCenteredOnUser] = useState(false);

  const isAdmin = userRole === 'admin';
  const availableRadii = isAdmin ? ADMIN_RADIUS_OPTIONS : RADIUS_OPTIONS;

  // 1. Process and annotate complaints with distance & radius filtering
  const { nearbyComplaints, rawIncidentCount } = useMemo(() => {
    const rawCount = complaints.length;
    let list = complaints.map((item) => {
      let lat = item.location?.latitude;
      let lng = item.location?.longitude;

      // Deterministic coordinate generator if missing
      if (!isValidCoordinate(lat, lng)) {
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

      let distanceKm = null;
      let distanceFormatted = null;

      if (userLocation && isValidCoordinate(userLocation.lat, userLocation.lng)) {
        distanceKm = calculateDistanceKm(userLocation.lat, userLocation.lng, lat, lng);
        distanceFormatted = formatDistance(distanceKm);
      } else if (typeof item.distanceKm === 'number') {
        distanceKm = item.distanceKm;
        distanceFormatted = item.distanceFormatted || formatDistance(distanceKm);
      }

      return {
        ...item,
        _computedLat: lat,
        _computedLng: lng,
        distanceKm,
        distanceFormatted,
      };
    });

    // Enforce Uber-style service radius boundary
    if (userLocation && !isAdmin) {
      list = list.filter((item) => {
        if (typeof item.distanceKm === 'number') {
          return item.distanceKm <= serviceRadius;
        }
        return true;
      });
    }

    // Sort by proximity when user location is tracked (closest first)
    if (userLocation) {
      list.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }

    return { nearbyComplaints: list, rawIncidentCount: rawCount };
  }, [complaints, userLocation, serviceRadius, isAdmin]);

  // 2. Filter complaints based on active category/priority pill
  const filteredComplaints = useMemo(() => {
    return nearbyComplaints.filter((item) => {
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
  }, [nearbyComplaints, activeFilter]);

  // Recenter map on user's current GPS location smoothly
  const handleRecenterOnUser = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userLocation) {
      const zoom = getOptimalZoomForRadius(serviceRadius);
      map.flyTo([userLocation.lat, userLocation.lng], zoom, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
      setIsCenteredOnUser(true);
    } else {
      // Prompt GPS request again if not active
      requestGeolocation();
    }
  }, [userLocation, serviceRadius]);

  // Request browser geolocation & setup real-time watchPosition
  const requestGeolocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }

    setLocationStatus('detecting');

    const handleSuccess = (position) => {
      const { latitude, longitude, accuracy, heading } = position.coords;
      const newLoc = {
        lat: parseFloat(latitude.toFixed(6)),
        lng: parseFloat(longitude.toFixed(6)),
        accuracy: Math.round(accuracy),
        heading: heading || null,
      };

      setUserLocation(newLoc);
      setLocationStatus('active');

      const map = mapInstanceRef.current;
      // Auto-focus on first acquisition
      if (map && !hasInitiallyCenteredRef.current) {
        hasInitiallyCenteredRef.current = true;
        const zoom = getOptimalZoomForRadius(serviceRadius);
        map.setView([newLoc.lat, newLoc.lng], zoom);
        setIsCenteredOnUser(true);

        // Notify parent callback if subscribed
        if (typeof onNearbySearch === 'function') {
          onNearbySearch(newLoc, serviceRadius);
        }
      }
    };

    const handleError = (error) => {
      if (error.code === 1) {
        // PERMISSION_DENIED
        setLocationStatus('denied');
      } else if (error.code === 2) {
        // POSITION_UNAVAILABLE
        setLocationStatus('unavailable');
      } else if (error.code === 3) {
        // TIMEOUT
        setLocationStatus('timeout');
      } else {
        setLocationStatus('unavailable');
      }
    };

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    };

    // Fast initial one-shot position
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);

    // Continuous watchPosition for live Uber-style puck updates
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
  }, [serviceRadius, onNearbySearch]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 14,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    // Standard high-reliability OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Layer groups for user puck and incident markers
    const userLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    userLayerRef.current = userLayer;
    markersLayerRef.current = markersLayer;

    // Detect user manual pan
    map.on('movestart', (e) => {
      // If motion triggered manually by dragging
      if (e.originalEvent) {
        setIsCenteredOnUser(false);
      }
    });

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    // Start geolocation immediately
    requestGeolocation();

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      userLayerRef.current = null;
    };
  }, [requestGeolocation]);

  // 3. Render Live User Location Marker, Accuracy Circle & Service Area Geofence
  useEffect(() => {
    const map = mapInstanceRef.current;
    const userLayer = userLayerRef.current;
    if (!map || !userLayer) return;

    userLayer.clearLayers();

    if (!userLocation) {
      map.setMaxBounds(null);
      return;
    }

    const { lat, lng, accuracy } = userLocation;

    // A. Accuracy indicator circle
    const accuracyCircle = L.circle([lat, lng], {
      radius: Math.max(accuracy, 20),
      color: '#3b82f6',
      fillColor: '#60a5fa',
      fillOpacity: 0.12,
      weight: 1,
      dashArray: '4, 4',
      interactive: false,
    });
    userLayer.addLayer(accuracyCircle);

    // B. Permitted service area radius circle (Uber-style boundary)
    const serviceRadiusMeters = serviceRadius * 1000;
    const serviceCircle = L.circle([lat, lng], {
      radius: serviceRadiusMeters,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
      weight: 2,
      dashArray: '6, 6',
    });

    serviceCircle.bindTooltip(
      `Authorized Service Radius: ${serviceRadius} km`,
      { sticky: true, className: 'user-live-tooltip' }
    );
    userLayer.addLayer(serviceCircle);

    // C. Uber-style live location navigation puck with pulse
    const puckIcon = L.divIcon({
      className: 'user-live-puck-container',
      html: `
        <div class="user-live-puck" title="Your Live Location">
          <div class="user-live-pulse"></div>
          <div class="user-live-dot"></div>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const userMarker = L.marker([lat, lng], {
      icon: puckIcon,
      zIndexOffset: 1000,
    });

    userMarker.bindTooltip(
      `<div style="text-align:center;"><strong>You are here</strong><br/><span style="font-size:10px; opacity:0.85;">Live GPS (±${accuracy}m)</span></div>`,
      { direction: 'top', offset: [0, -14], className: 'user-live-tooltip' }
    );
    userLayer.addLayer(userMarker);

    // D. Enforce boundary restriction on map view for regular users
    if (!isAdmin) {
      const bounds = serviceCircle.getBounds().pad(0.35);
      map.setMaxBounds(bounds);
      map.setMinZoom(Math.max(10, getOptimalZoomForRadius(serviceRadius) - 3));
    } else {
      map.setMaxBounds(null);
    }
  }, [userLocation, serviceRadius, isAdmin]);

  // 4. Render Incident Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    filteredComplaints.forEach((item) => {
      const lat = item._computedLat;
      const lng = item._computedLng;

      // Priority color class
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

      // Distance tag
      const distanceBadgeHtml = item.distanceFormatted
        ? `<div class="map-popup-distance-badge">📍 ${item.distanceFormatted}</div>`
        : '';

      const reportedDateFormatted = item.createdAt
        ? new Date(item.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null;

      const popupHtml = `
        <div class="map-popup-card">
          <div class="map-popup-header">
            <span class="map-popup-ticket">${item.complaintNumber || 'TICKET'}</span>
            <span class="cat-pill cat-pill--${item.category || 'other'}">${(item.category || 'other').replace('_', ' ')}</span>
          </div>
          <div class="map-popup-title">${item.title}</div>
          ${distanceBadgeHtml}
          <div class="map-popup-location">
            🏢 ${item.location?.building || 'Facility'}, Fl ${item.location?.floor || 1}, Rm ${item.location?.room || '—'}
          </div>
          ${
            reportedDateFormatted
              ? `<div class="map-popup-reported-at">Reported: ${reportedDateFormatted}</div>`
              : ''
          }
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
    });

    // If no user location is active, fit map to all incident pins
    if (!userLocation && filteredComplaints.length > 0) {
      const points = filteredComplaints.map((item) => [item._computedLat, item._computedLng]);
      if (points.length === 1) {
        map.setView(points[0], 15);
      } else {
        map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [filteredComplaints, userLocation]);

  // Fit all active incident markers
  function handleFitAll() {
    const map = mapInstanceRef.current;
    if (!map || filteredComplaints.length === 0) return;

    const points = filteredComplaints.map((item) => [item._computedLat, item._computedLng]);
    if (userLocation) {
      points.push([userLocation.lat, userLocation.lng]);
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
      setIsCenteredOnUser(false);
    }
  }

  // Handle radius selection change
  function handleRadiusChange(newRadius) {
    setServiceRadius(newRadius);
    const map = mapInstanceRef.current;
    if (map && userLocation) {
      const zoom = getOptimalZoomForRadius(newRadius);
      map.flyTo([userLocation.lat, userLocation.lng], zoom, { duration: 0.8 });
    }
    if (typeof onNearbySearch === 'function' && userLocation) {
      onNearbySearch(userLocation, newRadius);
    }
  }

  // Handle explicit "Search Nearby Incidents" click
  function handleSearchNearby() {
    if (userLocation) {
      handleRecenterOnUser();
      if (typeof onNearbySearch === 'function') {
        onNearbySearch(userLocation, serviceRadius);
      }
    } else {
      requestGeolocation();
    }
  }

  return (
    <div className={`complaints-map-card ${className}`.trim()}>
      <div className="map-card-header">
        <div className="map-card-title-group">
          <div className="map-card-title">
            <span>{title}</span>
            {locationStatus === 'active' && userLocation && (
              <span className="map-status-pill map-status-pill--active" title="GPS lock acquired">
                <span className="map-status-dot map-status-dot--pulse" />
                Live GPS Active (±{userLocation.accuracy}m)
              </span>
            )}
            {locationStatus === 'detecting' && (
              <span className="map-status-pill map-status-pill--detecting">
                <span className="map-status-spinner" />
                Detecting Location...
              </span>
            )}
            {locationStatus === 'denied' && (
              <button
                type="button"
                className="map-status-pill map-status-pill--denied"
                onClick={requestGeolocation}
                title="Click to request browser location permission"
              >
                Location Permission Required
              </button>
            )}
            {['unavailable', 'timeout'].includes(locationStatus) && (
              <span className="map-status-pill map-status-pill--unavailable">
                GPS Unavailable
              </span>
            )}
          </div>
          <span className="map-card-subtitle">{subtitle}</span>
        </div>

        <div className="map-card-controls">
          {/* Configurable Nearby Service Radius Selector */}
          <div className="map-radius-group" title="Service Radius Area">
            <span className="map-radius-label">Radius:</span>
            {availableRadii.map((r) => (
              <button
                key={r}
                type="button"
                className={`map-radius-btn ${serviceRadius === r ? 'map-radius-btn--active' : ''}`}
                onClick={() => handleRadiusChange(r)}
                aria-pressed={serviceRadius === r}
              >
                {r} km
              </button>
            ))}
          </div>

          {/* Filter Pills */}
          <div className="map-filter-pills" role="tablist" aria-label="Map Filters">
            <button
              type="button"
              className={`map-pill ${activeFilter === 'all' ? 'map-pill--active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All ({nearbyComplaints.length})
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

          {/* My Location Button */}
          <Button
            variant={locationStatus === 'active' ? 'primary' : 'secondary'}
            size="sm"
            onClick={handleRecenterOnUser}
            className="btn-with-icon"
            title="Recenter and zoom to your live location"
          >
            <CrosshairIcon size={14} />
            <span>My Location</span>
          </Button>

          {/* Search Nearby Incidents */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSearchNearby}
            className="btn-with-icon"
            title="Search incidents in your permitted radius"
          >
            <SearchIcon size={13} />
            <span>Search Nearby</span>
          </Button>

          {/* Fit Markers */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleFitAll}
            title="Recenter and zoom to show all active pins"
          >
            Fit All
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

        {/* Floating Recenter Button if panned away */}
        {userLocation && !isCenteredOnUser && (
          <button
            type="button"
            className="map-floating-recenter"
            onClick={handleRecenterOnUser}
            title="Recenter on your location"
          >
            <CrosshairIcon size={14} />
            <span>Recenter Map</span>
          </button>
        )}

        {/* Empty state banner if no incidents within radius or filter */}
        {filteredComplaints.length === 0 && (
          <div className="map-empty-overlay">
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>📍</div>
            <p className="font-semibold text-sm">
              {userLocation
                ? `No Incidents in Your ${serviceRadius} km Zone`
                : 'No Incidents Plotted'}
            </p>
            <p className="text-xs text-muted mt-1" style={{ maxWidth: '300px', margin: '0 auto' }}>
              {userLocation
                ? `There are currently no maintenance complaints within your permitted ${serviceRadius} km service area matching this filter.`
                : 'There are currently no maintenance complaints matching this filter.'}
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
          {userLocation && (
            <div className="map-legend-item" style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
              <span className="user-live-dot" style={{ display: 'inline-block', width: 8, height: 8 }} />
              <span style={{ color: '#2563eb', fontWeight: 600 }}>Your GPS Location</span>
            </div>
          )}
        </div>

        <div className="map-meta-count">
          Showing <strong>{filteredComplaints.length}</strong> nearby incident{filteredComplaints.length === 1 ? '' : 's'}
          {userLocation && (
            <span> within <strong>{serviceRadius} km</strong> service zone</span>
          )}
          {rawIncidentCount > filteredComplaints.length && (
            <span style={{ color: '#94a3b8', marginLeft: '4px' }}>
              ({rawIncidentCount - filteredComplaints.length} outside radius)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ComplaintsMap;
