import { useState, useCallback, useMemo, useRef } from 'react';
import Map, { NavigationControl, Source, Layer, Popup } from 'react-map-gl/maplibre';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

const BASE = import.meta.env.BASE_URL;

const LAYER_COLORS = {
  wwtp: '#f97316',
  wwtp_pa: '#fb923c',
  treatment: '#0ea5e9',
  dams: '#a855f7',
  aqueducts: '#22d3ee',
  pa_pws: '#38bdf8',
  cws: '#14b8a6',
} as const;

type LayerId = keyof typeof LAYER_COLORS;

interface PopupInfo {
  longitude: number;
  latitude: number;
  properties: Record<string, unknown>;
  layer: string;
}

const INITIAL_VIEW = {
  longitude: -98.5,
  latitude: 39.5,
  zoom: 3.6,
};

function prettyProps(props: Record<string, unknown>): [string, string][] {
  const skip = new Set(['OBJECTID', 'OBJECTID_1', 'Shape__Area', 'Shape__Length']);
  return Object.entries(props)
    .filter(([k, v]) => !skip.has(k) && v != null && String(v).trim() !== '')
    .map(([k, v]) => [k.replace(/^CWP_/, '').replace(/_/g, ' '), String(v)]);
}

export default function App() {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({
    wwtp: true,
    wwtp_pa: false,
    treatment: false,
    dams: true,
    aqueducts: false,
    pa_pws: true,
    cws: true,
  });
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [status] = useState('Live public GIS · Full NID · EPA CWS · EPA WWTP · PA DEP');

  const toggleLayer = useCallback((id: LayerId) => {
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const onMapClick = useCallback((e: MapLayerMouseEvent) => {
    const feat = e.features?.[0];
    if (!feat || !feat.properties) {
      setPopup(null);
      return;
    }
    setPopup({
      longitude: e.lngLat.lng,
      latitude: e.lngLat.lat,
      properties: feat.properties as Record<string, unknown>,
      layer: String(feat.layer?.id ?? 'feature'),
    });
  }, []);

  const doSearch = useCallback(async () => {
    if (!searchQ.trim()) return;
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', searchQ);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('countrycodes', 'us');
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'WaterGridXplr/1.0 (educational; github pages)' },
      });
      const data = await res.json();
      if (data?.[0]) {
        const { lon, lat } = data[0];
        mapRef.current?.flyTo({
          center: [parseFloat(lon), parseFloat(lat)],
          zoom: 10,
          duration: 1500,
        });
      }
    } catch {
      /* ignore */
    }
  }, [searchQ]);

  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = [];
    if (layers.cws) ids.push('cws-points');
    if (layers.wwtp) ids.push('wwtp-points');
    if (layers.wwtp_pa) ids.push('wwtp-pa-points');
    if (layers.treatment) ids.push('treatment-points');
    if (layers.dams) ids.push('dams-points');
    if (layers.aqueducts) ids.push('aqueducts-lines');
    if (layers.pa_pws) ids.push('pa-pws-fill', 'pa-pws-outline');
    return ids;
  }, [layers]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <svg className="logo" viewBox="0 0 32 32" fill="none" aria-hidden>
            <path
              d="M16 2C16 2 6 14 6 20a10 10 0 0 0 20 0C26 14 16 2 16 2z"
              fill="#0ea5e9"
              stroke="#0369a1"
              strokeWidth="1.5"
            />
            <path
              d="M16 8c0 0-4 6-4 9a4 4 0 0 0 8 0c0-3-4-9-4-9z"
              fill="#7dd3fc"
              opacity="0.7"
            />
          </svg>
          <div>
            <h1>WaterGridXplr</h1>
            <div className="subtitle">US Water Infrastructure Explorer</div>
          </div>
        </div>

        <div className="sidebar-body">
          <div className="section">
            <div className="section-title">National Snapshot</div>
            <div className="kpi-grid">
              <div className="kpi">
                <div className="kpi-label">Total withdrawals</div>
                <div className="kpi-value">
                  ~322 <span className="kpi-unit">BGD</span>
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Public supply</div>
                <div className="kpi-value">
                  ~39 <span className="kpi-unit">BGD</span>
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Avg residential</div>
                <div className="kpi-value">
                  ~$5.15 <span className="kpi-unit">/1k gal</span>
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">NID dams</div>
                <div className="kpi-value">
                  92,766 <span className="kpi-unit">loaded</span>
                </div>
              </div>
            </div>
            <p className="sources-note">
              USGS water-use (2015) · AWWA rate surveys · NID/NTAD · EPA FRS/ICIS.
              Local rates vary widely.
            </p>
          </div>

          <div className="section">
            <div className="section-title">Search location</div>
            <div className="search-box">
              <input
                type="text"
                placeholder="City, ZIP, or landmark…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              />
              <button type="button" onClick={doSearch}>
                Go
              </button>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Infrastructure layers (public GIS)</div>
            <div className="layer-list">
              {(
                [
                  { id: 'cws' as LayerId, label: 'CWS service centroids (EPA)', note: '~41k national' },
                  { id: 'dams' as LayerId, label: 'All NID dams', note: '92,766 national' },
                  { id: 'wwtp' as LayerId, label: 'WWTP Majors (EPA FRS/ICIS)', note: '2,000 national' },
                  { id: 'pa_pws' as LayerId, label: 'PA PWS service areas', note: '300 polygons' },
                  { id: 'wwtp_pa' as LayerId, label: 'PA wastewater plants', note: '~974 PA' },
                  { id: 'aqueducts' as LayerId, label: 'Major aqueduct corridors', note: 'illustrative' },
                  { id: 'treatment' as LayerId, label: 'Drinking WTP samples', note: 'demo plants' },
                ] as const
              ).map((l) => (
                <label key={l.id} className="layer-item">
                  <input
                    type="checkbox"
                    checked={layers[l.id]}
                    onChange={() => toggleLayer(l.id)}
                  />
                  <span
                    className="layer-swatch"
                    style={{ background: LAYER_COLORS[l.id] }}
                  />
                  <span className="layer-label">{l.label}</span>
                  <span className="layer-count">{l.note}</span>
                </label>
              ))}
            </div>
            <p className="sources-note">
              Real data from EPA FRS/ICIS (wastewater), USACE/BTS NID via NTAD
              (dams), and PA DEP eMapPA / PASDA (public water supplier service
              areas). Expand with full national EPA service-area boundaries,
              state portals, USGS NHD, and OSM. See README.
            </p>
          </div>

          <div className="section">
            <div className="section-title">Water costs & usage metadata</div>
            <div className="costs-panel">
              <div className="row">
                <span>National avg (approx)</span>
                <span>$3.85 / CCF</span>
              </div>
              <div className="row">
                <span>≈ per 1,000 gallons</span>
                <span>$5.15</span>
              </div>
              <div className="row">
                <span>Irrigation (USGS)</span>
                <span>~118 BGD</span>
              </div>
              <div className="row">
                <span>Thermoelectric</span>
                <span>~133 BGD</span>
              </div>
              <p className="note">
                Click map features for facility metadata (name, NPDES, permit
                status, height, purpose, ownership). Full retail rates live in
                utility tariffs and state PUC filings.
              </p>
            </div>
          </div>
        </div>

        <div className="status-bar">
          <span className="status-dot" />
          {status}
        </div>
      </aside>

      <div className="map-wrap">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          interactiveLayerIds={interactiveLayerIds}
          onClick={onMapClick}
          cursor={interactiveLayerIds.length ? 'pointer' : ''}
          attributionControl={true}
        >
          <NavigationControl position="top-right" />

          {layers.cws && (
            <Source
              id="cws"
              type="geojson"
              data={`${BASE}data/cws_service_centroids.geojson`}
            >
              <Layer
                id="cws-points"
                type="circle"
                paint={{
                  'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    3, 2,
                    8, 4,
                    12, 7,
                  ],
                  'circle-color': LAYER_COLORS.cws,
                  'circle-stroke-width': 0.5,
                  'circle-stroke-color': '#fff',
                  'circle-opacity': 0.75,
                }}
              />
            </Source>
          )}


          {layers.pa_pws && (
            <Source
              id="pa-pws"
              type="geojson"
              data={`${BASE}data/pa_pws_service_areas.geojson`}
            >
              <Layer
                id="pa-pws-fill"
                type="fill"
                paint={{
                  'fill-color': LAYER_COLORS.pa_pws,
                  'fill-opacity': 0.25,
                }}
              />
              <Layer
                id="pa-pws-outline"
                type="line"
                paint={{
                  'line-color': LAYER_COLORS.pa_pws,
                  'line-width': 1,
                  'line-opacity': 0.7,
                }}
              />
            </Source>
          )}

          {layers.wwtp && (
            <Source
              id="wwtp"
              type="geojson"
              data={`${BASE}data/wwtp_major.geojson`}
            >
              <Layer
                id="wwtp-points"
                type="circle"
                paint={{
                  'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    3, 3,
                    8, 6,
                    12, 9,
                  ],
                  'circle-color': LAYER_COLORS.wwtp,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#fff',
                  'circle-opacity': 0.9,
                }}
              />
            </Source>
          )}

          {layers.wwtp_pa && (
            <Source
              id="wwtp-pa"
              type="geojson"
              data={`${BASE}data/wwtp_pa.geojson`}
            >
              <Layer
                id="wwtp-pa-points"
                type="circle"
                paint={{
                  'circle-radius': 5,
                  'circle-color': LAYER_COLORS.wwtp_pa,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#fff',
                }}
              />
            </Source>
          )}

          {layers.dams && (
            <Source
              id="dams"
              type="geojson"
              data={`${BASE}data/nid_dams_full.geojson`}
            >
              <Layer
                id="dams-points"
                type="circle"
                paint={{
                  'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    3, 3,
                    8, 5,
                    12, 8,
                  ],
                  'circle-color': LAYER_COLORS.dams,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#fff',
                }}
              />
            </Source>
          )}

          {layers.treatment && (
            <Source
              id="treatment"
              type="geojson"
              data={`${BASE}data/sample_water_treatment.geojson`}
            >
              <Layer
                id="treatment-points"
                type="circle"
                paint={{
                  'circle-radius': 7,
                  'circle-color': LAYER_COLORS.treatment,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#fff',
                }}
              />
            </Source>
          )}

          {layers.aqueducts && (
            <Source
              id="aqueducts"
              type="geojson"
              data={`${BASE}data/sample_aqueducts.geojson`}
            >
              <Layer
                id="aqueducts-lines"
                type="line"
                paint={{
                  'line-color': LAYER_COLORS.aqueducts,
                  'line-width': 3,
                  'line-opacity': 0.85,
                }}
              />
            </Source>
          )}

          {popup && (
            <Popup
              longitude={popup.longitude}
              latitude={popup.latitude}
              anchor="bottom"
              onClose={() => setPopup(null)}
              closeOnClick={false}
              maxWidth="320px"
            >
              <div className="water-popup">
                <h3>
                  {String(
                    popup.properties.CWP_NAME ||
                      popup.properties.PWS_Name ||
                      popup.properties.name ||
                      popup.properties.NAME ||
                      'Feature'
                  )}
                </h3>
                {prettyProps(popup.properties).map(([k, v]) => (
                  <div key={k} className="meta-row">
                    <span className="meta-key">{k}</span>
                    <span className="meta-val">{v}</span>
                  </div>
                ))}
              </div>
            </Popup>
          )}
        </Map>

        <div className="legend">
          <div className="legend-title">Layers</div>
          {layers.wwtp && (
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: LAYER_COLORS.wwtp }} />
              WWTP Majors (EPA)
            </div>
          )}
          {layers.wwtp_pa && (
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: LAYER_COLORS.wwtp_pa }} />
              PA WWTP
            </div>
          )}
          {layers.dams && (
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: LAYER_COLORS.dams }} />
              High-hazard dams
            </div>
          )}
          {layers.pa_pws && (
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: LAYER_COLORS.pa_pws }} />
              PA service areas
            </div>
          )}
          {layers.aqueducts && (
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: LAYER_COLORS.aqueducts }} />
              Aqueducts
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
