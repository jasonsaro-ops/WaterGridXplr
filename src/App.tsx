import { useState, useCallback, useMemo, useRef } from 'react';
import Map, { NavigationControl, Source, Layer, Popup } from 'react-map-gl/maplibre';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

const BASE = import.meta.env.BASE_URL;

const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

const LAYER_COLORS = {
  wwtp: '#f97316',
  wwtp_pa: '#fb923c',
  treatment: '#0ea5e9',
  dams: '#a855f7',
  aqueducts: '#22d3ee',
  pa_pws: '#38bdf8',
  cws: '#14b8a6',
  state: '#2dd4bf',
} as const;

type CoreLayerId = 'wwtp' | 'wwtp_pa' | 'treatment' | 'dams' | 'aqueducts' | 'pa_pws' | 'cws';

interface PopupInfo {
  longitude: number;
  latitude: number;
  properties: Record<string, unknown>;
}

const INITIAL_VIEW = { longitude: -98.5, latitude: 39.5, zoom: 3.6 };

const LABEL_MAP: Record<string, string> = {
  CWP_NAME: 'Name',
  name: 'Name',
  NAME: 'Name',
  PWS_Name: 'System name',
  PWSID: 'PWS ID',
  Primacy_Agency: 'Primacy agency',
  Population_Served_Count: 'Population served',
  Service_Connections_Count: 'Service connections',
  Service_Area_Type: 'Service area type',
  Verification_Status: 'Verification',
  Area_SqKM: 'Area (km²)',
  nidId: 'NID ID',
  state: 'State',
  county: 'County',
  city: 'City',
  nidHeight: 'Height (ft)',
  primaryPurposeId: 'Primary purpose',
  ownerNames: 'Owner',
  publicHazardId: 'Hazard class',
  latitude: 'Latitude',
  longitude: 'Longitude',
  CNTY_NAME: 'County',
  OWNERSHIP: 'Ownership',
  GW_SOURCE: 'Groundwater source',
  SW_SOURCE: 'Surface water source',
  WUDS_ID: 'WUDS ID',
  NPDES_ID: 'NPDES ID',
  CWP_CITY: 'City',
  CWP_STATE: 'State',
  CWP_ZIP: 'ZIP',
  CWP_COUNTY: 'County',
  CWP_FACILITY_TYPE_INDICATOR: 'Facility type',
  CWP_MAJOR_MINOR_STATUS: 'Major/Minor',
  CWP_PERMIT_STATUS_DESC: 'Permit status',
  STATE_WATER_BODY_NAME: 'Receiving water',
};

function prettyProps(props: Record<string, unknown>): [string, string][] {
  const skip = new Set([
    'OBJECTID', 'OBJECTID_1', 'Shape__Area', 'Shape__Length',
    'name', 'NAME', 'CWP_NAME', 'PWS_Name', // shown as title
  ]);
  const rows: [string, string][] = [];
  for (const [k, v] of Object.entries(props)) {
    if (skip.has(k) || v == null || String(v).trim() === '') continue;
    const label = LABEL_MAP[k] || k.replace(/^CWP_/, '').replace(/_/g, ' ');
    rows.push([label, String(v)]);
  }
  return rows;
}

export default function App() {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [layers, setLayers] = useState<Record<CoreLayerId, boolean>>({
    wwtp: true,
    wwtp_pa: false,
    treatment: false,
    dams: true,
    aqueducts: false,
    pa_pws: true,
    cws: true,
  });
  // All state layers OFF by default
  const [stateLayers, setStateLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(US_STATES.map((s) => [s.code, false]))
  );
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [status] = useState('Public GIS · NID · EPA CWS · PA DEP');
  const [showStates, setShowStates] = useState(false);

  const toggleLayer = useCallback((id: CoreLayerId) => {
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleState = useCallback((code: string) => {
    setStateLayers((prev) => ({ ...prev, [code]: !prev[code] }));
  }, []);

  const onMapClick = useCallback((e: MapLayerMouseEvent) => {
    const feat = e.features?.[0];
    if (!feat?.properties) {
      setPopup(null);
      return;
    }
    setPopup({
      longitude: e.lngLat.lng,
      latitude: e.lngLat.lat,
      properties: feat.properties as Record<string, unknown>,
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
        mapRef.current?.flyTo({
          center: [parseFloat(data[0].lon), parseFloat(data[0].lat)],
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
    for (const s of US_STATES) {
      if (stateLayers[s.code]) ids.push(`state-${s.code}-points`);
    }
    return ids;
  }, [layers, stateLayers]);

  const enabledStateCount = useMemo(
    () => Object.values(stateLayers).filter(Boolean).length,
    [stateLayers]
  );

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
            <div className="section-title">National layers</div>
            <div className="layer-list">
              {(
                [
                  { id: 'cws' as CoreLayerId, label: 'CWS systems (all states)', note: '~41k EPA' },
                  { id: 'dams' as CoreLayerId, label: 'All NID dams', note: '92,766' },
                  { id: 'wwtp' as CoreLayerId, label: 'WWTP Majors (EPA)', note: '2,000' },
                  { id: 'pa_pws' as CoreLayerId, label: 'PA service area polygons', note: 'DEP' },
                  { id: 'wwtp_pa' as CoreLayerId, label: 'PA wastewater plants', note: '~974' },
                  { id: 'aqueducts' as CoreLayerId, label: 'Major aqueducts', note: 'sample' },
                  { id: 'treatment' as CoreLayerId, label: 'Drinking WTP samples', note: 'demo' },
                ] as const
              ).map((l) => (
                <label key={l.id} className="layer-item">
                  <input
                    type="checkbox"
                    checked={layers[l.id]}
                    onChange={() => toggleLayer(l.id)}
                  />
                  <span className="layer-swatch" style={{ background: LAYER_COLORS[l.id] }} />
                  <span className="layer-label">{l.label}</span>
                  <span className="layer-count">{l.note}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="section-title">
              State CWS layers (default OFF)
              <button
                type="button"
                className="section-toggle"
                onClick={() => setShowStates((v) => !v)}
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  background: '#0f2744',
                  border: '1px solid #1e3a5f',
                  color: '#7dd3fc',
                  borderRadius: 4,
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                {showStates ? 'Hide' : 'Show'} ({enabledStateCount} on)
              </button>
            </div>
            {showStates && (
              <div className="layer-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {US_STATES.map((s) => (
                  <label key={s.code} className="layer-item">
                    <input
                      type="checkbox"
                      checked={!!stateLayers[s.code]}
                      onChange={() => toggleState(s.code)}
                    />
                    <span
                      className="layer-swatch"
                      style={{ background: LAYER_COLORS.state }}
                    />
                    <span className="layer-label">
                      {s.name} ({s.code})
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="sources-note">
              Per-state layers use EPA Community Water System records (PWSID, name,
              population served, connections, area). PA also has DEP service-area
              polygons. Enable only the states you need.
            </p>
          </div>

          <div className="section">
            <div className="section-title">Water costs & usage</div>
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
                Click map features for system/dam metadata. Retail rates are in
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
            <Source id="cws" type="geojson" data={`${BASE}data/cws_service_centroids.geojson`}>
              <Layer
                id="cws-points"
                type="circle"
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2, 8, 4, 12, 7],
                  'circle-color': LAYER_COLORS.cws,
                  'circle-stroke-width': 0.5,
                  'circle-stroke-color': '#fff',
                  'circle-opacity': 0.75,
                }}
              />
            </Source>
          )}

          {US_STATES.map(
            (s) =>
              stateLayers[s.code] && (
                <Source
                  key={s.code}
                  id={`state-${s.code}`}
                  type="geojson"
                  data={`${BASE}data/states/cws_${s.code.toLowerCase()}.geojson`}
                >
                  <Layer
                    id={`state-${s.code}-points`}
                    type="circle"
                    paint={{
                      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 8, 6, 12, 9],
                      'circle-color': LAYER_COLORS.state,
                      'circle-stroke-width': 1,
                      'circle-stroke-color': '#ecfeff',
                      'circle-opacity': 0.9,
                    }}
                  />
                </Source>
              )
          )}

          {layers.pa_pws && (
            <Source id="pa-pws" type="geojson" data={`${BASE}data/pa_pws_service_areas.geojson`}>
              <Layer
                id="pa-pws-fill"
                type="fill"
                paint={{ 'fill-color': LAYER_COLORS.pa_pws, 'fill-opacity': 0.25 }}
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
            <Source id="wwtp" type="geojson" data={`${BASE}data/wwtp_major.geojson`}>
              <Layer
                id="wwtp-points"
                type="circle"
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 8, 6, 12, 9],
                  'circle-color': LAYER_COLORS.wwtp,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#fff',
                  'circle-opacity': 0.9,
                }}
              />
            </Source>
          )}

          {layers.wwtp_pa && (
            <Source id="wwtp-pa" type="geojson" data={`${BASE}data/wwtp_pa.geojson`}>
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
            <Source id="dams" type="geojson" data={`${BASE}data/nid_dams_full.geojson`}>
              <Layer
                id="dams-points"
                type="circle"
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 8, 5, 12, 8],
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
            <Source id="aqueducts" type="geojson" data={`${BASE}data/sample_aqueducts.geojson`}>
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
          {layers.cws && (
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: LAYER_COLORS.cws }} />
              CWS (national)
            </div>
          )}
          {enabledStateCount > 0 && (
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: LAYER_COLORS.state }} />
              State CWS ({enabledStateCount})
            </div>
          )}
          {layers.dams && (
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: LAYER_COLORS.dams }} />
              NID dams
            </div>
          )}
          {layers.wwtp && (
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: LAYER_COLORS.wwtp }} />
              WWTP majors
            </div>
          )}
          {layers.pa_pws && (
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: LAYER_COLORS.pa_pws }} />
              PA polygons
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
