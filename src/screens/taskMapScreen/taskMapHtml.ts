function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

export function buildGoogleMapsHtml(params: {
  apiKey: string;
  latitude: number;
  longitude: number;
  title: string;
  night?: boolean;
}): string {
  const key = escapeJsString(params.apiKey);
  const title = escapeJsString(params.title);
  const lat = Number(params.latitude);
  const lng = Number(params.longitude);
  const night = params.night ? 'true' : 'false';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    .gm-fullscreen-control { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = null;
    var routeLine = null;
    var altLines = [];
    var userMarker = null;
    var arrivalCircle = null;
    var storeLat = ${lat};
    var storeLng = ${lng};
    var followMe = true;
    var userInteracting = false;
    var lastHeading = 0;
    var animFrame = null;
    var dragNotifyTimer = null;
    var routeFitted = false;
    var DARK_STYLES = [
      { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
      { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
      { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
      { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
      { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
      { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] }
    ];

    function post(type, payload) {
      try {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify(Object.assign({ type: type }, payload || {}))
        );
      } catch (e) {}
    }

    function userIcon(heading) {
      return {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: '#1D70F1',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
        rotation: Number(heading) || 0,
      };
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function toPath(coords) {
      return (coords || []).map(function(c) {
        return { lat: Number(c.latitude), lng: Number(c.longitude) };
      }).filter(function(p) {
        return isFinite(p.lat) && isFinite(p.lng);
      });
    }

    function cancelMarkerAnim() {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
      }
    }

    function beginInteraction() {
      followMe = false;
      userInteracting = true;
      cancelMarkerAnim();
    }

    function notifyDragged() {
      if (dragNotifyTimer) {
        clearTimeout(dragNotifyTimer);
      }
      dragNotifyTimer = setTimeout(function() {
        dragNotifyTimer = null;
        post('user_dragged');
      }, 50);
    }

    function endInteraction() {
      if (!userInteracting) {
        return;
      }
      userInteracting = false;
      notifyDragged();
    }

    function initMap() {
      try {
        var mapEl = document.getElementById('map');
        map = new google.maps.Map(mapEl, {
          center: { lat: storeLat, lng: storeLng },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          rotateControl: false,
          tilt: 0,
          keyboardShortcuts: false,
          gestureHandling: 'greedy',
          styles: ${night} ? DARK_STYLES : [],
        });
        new google.maps.Marker({
          position: { lat: storeLat, lng: storeLng },
          map: map,
          title: '${title}',
        });
        var traffic = new google.maps.TrafficLayer();
        traffic.setMap(map);
        mapEl.addEventListener('touchstart', beginInteraction, { passive: true });
        mapEl.addEventListener('mousedown', beginInteraction);
        mapEl.addEventListener('touchend', endInteraction, { passive: true });
        mapEl.addEventListener('touchcancel', endInteraction, { passive: true });
        mapEl.addEventListener('mouseup', endInteraction);
        map.addListener('dragstart', beginInteraction);
        map.addListener('dragend', endInteraction);
        post('map_ready');
      } catch (e) {
        post('map_error', { message: String(e && e.message ? e.message : e) });
      }
    }

    window.setMapType = function(type) {
      try {
        if (!map) return;
        map.setMapTypeId(type);
      } catch (e) {}
    };

    window.zoomBy = function(delta) {
      try {
        if (!map) return;
        var next = (map.getZoom() || 13) + Number(delta);
        map.setZoom(Math.min(21, Math.max(3, next)));
      } catch (e) {}
    };

    window.setNight = function(on) {
      try {
        if (!map) return;
        map.setOptions({ styles: on ? DARK_STYLES : [] });
      } catch (e) {}
    };

    window.recenter = function(lat, lng) {
      try {
        if (!map) return;
        var position = { lat: Number(lat), lng: Number(lng) };
        userInteracting = false;
        followMe = true;
        map.panTo(position);
        map.setZoom(Math.max(map.getZoom() || 15, 16));
      } catch (e) {}
    };

    window.setFollowMe = function(on) {
      followMe = !!on;
      if (followMe) {
        userInteracting = false;
      }
    };

    window.setHeading = function(deg) {
      if (deg == null || !isFinite(Number(deg)) || Number(deg) < 0) {
        return;
      }
      lastHeading = Number(deg);
      try {
        if (userMarker) {
          userMarker.setIcon(userIcon(lastHeading));
        }
      } catch (e) {}
    };

    window.updateUserPosition = function(lat, lng, heading) {
      try {
        if (!map) {
          post('user_error', { message: 'map_not_ready' });
          return;
        }
        var dest = { lat: Number(lat), lng: Number(lng) };
        var nextHeading = (heading == null || heading < 0 || !isFinite(Number(heading)))
          ? lastHeading
          : Number(heading);
        lastHeading = nextHeading;
        if (!userMarker) {
          userMarker = new google.maps.Marker({
            position: dest,
            map: map,
            title: 'You',
            icon: userIcon(nextHeading),
            zIndex: 999,
          });
          if (followMe && !userInteracting) {
            map.panTo(dest);
          }
          post('user_updated', { latitude: dest.lat, longitude: dest.lng });
          return;
        }
        cancelMarkerAnim();
        var start = userMarker.getPosition();
        var sLat = start.lat();
        var sLng = start.lng();
        var t0 = Date.now();
        var dur = 350;
        function tick() {
          var t = Math.min(1, (Date.now() - t0) / dur);
          var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          var pos = { lat: lerp(sLat, dest.lat, ease), lng: lerp(sLng, dest.lng, ease) };
          userMarker.setPosition(pos);
          userMarker.setIcon(userIcon(nextHeading));
          if (followMe && !userInteracting) {
            map.panTo(pos);
          }
          if (t < 1) {
            animFrame = requestAnimationFrame(tick);
          } else {
            animFrame = null;
          }
        }
        tick();
        post('user_updated', { latitude: dest.lat, longitude: dest.lng });
      } catch (e) {
        post('user_error', { message: String(e && e.message ? e.message : e) });
      }
    };

    window.drawRoute = function(coords, fit) {
      try {
        if (!map || !Array.isArray(coords) || coords.length < 2) {
          post('route_error', { message: 'invalid_coords' });
          return;
        }
        var path = toPath(coords);
        if (path.length < 2) {
          post('route_error', { message: 'invalid_coords' });
          return;
        }
        if (routeLine) {
          routeLine.setMap(null);
        }
        routeLine = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: '#1D70F1',
          strokeOpacity: 0.95,
          strokeWeight: 6,
          zIndex: 4,
          map: map,
        });
        var shouldFit = fit === true || (fit !== false && !routeFitted);
        if (shouldFit) {
          var bounds = new google.maps.LatLngBounds();
          path.forEach(function(p) { bounds.extend(p); });
          map.fitBounds(bounds, 48);
          routeFitted = true;
        }
        post('route_drawn', { points: path.length });
      } catch (e) {
        post('route_error', { message: String(e && e.message ? e.message : e) });
      }
    };

    window.drawAltRoutes = function(routes, selectedIndex) {
      try {
        altLines.forEach(function(line) { line.setMap(null); });
        altLines = [];
        if (!map || !Array.isArray(routes)) {
          return;
        }
        routes.forEach(function(route, index) {
          if (index === selectedIndex) {
            return;
          }
          var path = toPath(route.coordinates || route);
          if (path.length < 2) {
            return;
          }
          var line = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#94A3B8',
            strokeOpacity: 0.7,
            strokeWeight: 4,
            zIndex: 2,
            map: map,
          });
          line.addListener('click', function() {
            post('alt_tapped', { index: index });
          });
          altLines.push(line);
        });
      } catch (e) {}
    };

    window.drawArrivalCircle = function(lat, lng, radiusM) {
      try {
        if (!map) return;
        if (arrivalCircle) {
          arrivalCircle.setMap(null);
          arrivalCircle = null;
        }
        var radius = Number(radiusM);
        if (!isFinite(radius) || radius <= 0) {
          return;
        }
        arrivalCircle = new google.maps.Circle({
          center: { lat: Number(lat), lng: Number(lng) },
          radius: radius,
          strokeColor: '#1D70F1',
          strokeOpacity: 0.85,
          strokeWeight: 2,
          fillColor: '#1D70F1',
          fillOpacity: 0.12,
          map: map,
          clickable: false,
        });
      } catch (e) {}
    };

    window.onGoogleMapsFailed = function() {
      post('map_error', { message: 'script_load_failed' });
    };
  </script>
  <script
    src="https://maps.googleapis.com/maps/api/js?key=${key}&callback=initMap"
    async
    defer
    onerror="window.onGoogleMapsFailed && window.onGoogleMapsFailed()"
  ></script>
</body>
</html>`;
}
