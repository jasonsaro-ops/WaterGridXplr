import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { NavigationControl, Source, Layer, Popup } from 'react-map-gl/maplibre';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

const BASE = import.meta.env.BASE_URL;
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

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
  gauges: '#facc15',
} as const;

type CoreLayerId = keyof typeof LAYER_COLORS;

interface PopupInfo {
  longitude: number;
  latitude: number;
  properties: Record<string, unknown>;
}

interface LiveReading {
  siteName: string;
  siteCode: string;
  parameter: string;
  value: string;
  unit: string;
  time: string;
}

interface HistoryPoint {
  time: string;
  value: string;
}

const INITIAL_VIEW = { longitude: -98.5, latitude: 39.5, zoom: 3.6 };

const LABEL_MAP: Record<string, string> = {
  CWP_NAME: 'Name', name: 'Name', NAME: 'Name', PWS_Name: 'System name',
  PWSID: 'PWS ID', Primacy_Agency: 'Primacy agency',
  Population_Served_Count: 'Population served',
  Service_Connections_Count: 'Service connections',
  Service_Area_Type: 'Service area type', Verification_Status: 'Verification',
  Area_SqKM: 'Area (km²)', nidId: 'NID ID', state: 'State', county: 'County',
  city: 'City', nidHeight: 'Height (ft)', primaryPurposeId: 'Primary purpose',
  ownerNames: 'Owner', publicHazardId: 'Hazard class',
  latitude: 'Latitude', longitude: 'Longitude',
  CNTY_NAME: 'County', OWNERSHIP: 'Ownership',
  GW_SOURCE: 'Groundwater source', SW_SOURCE: 'Surface water source',
  WUDS_ID: 'WUDS ID', NPDES_ID: 'NPDES ID',
  CWP_CITY: 'City', CWP_STATE: 'State', CWP_ZIP: 'ZIP', CWP_COUNTY: 'County',
  CWP_FACILITY_TYPE_INDICATOR: 'Facility type',
  CWP_MAJOR_MINOR_STATUS: 'Major/Minor',
  CWP_PERMIT_STATUS_DESC: 'Permit status',
  STATE_WATER_BODY_NAME: 'Receiving water',
};

function prettyProps(props: Record<string, unknown>): [string, string][] {
  const skip = new Set([
    'OBJECTID', 'OBJECTID_1', 'Shape__Area', 'Shape__Length',
    'name', 'NAME', 'CWP_NAME', 'PWS_Name',
  ]);
  const rows: [string, string][] = [];
  for (const [k, v] of Object.entries(props)) {
    if (skip.has(k) || v == null || String(v).trim() === '') continue;
    const label = LABEL_MAP[k] || k.replace(/^CWP_/, '').replace(/_/g, ' ');
    rows.push([label, String(v)]);
  }
  return rows;
}

function featureTitle(props: Record<string, unknown>): string {
  return String(
    props.CWP_NAME || props.PWS_Name || props.name || props.NAME || 'Feature'
  );
}

/** USGS near real-time IV for a state (streamflow 00060 + gage height 00065) */
async function fetchUsgsStateLive(stateCd: string): Promise<{
  readings: LiveReading[];
  geojson: GeoJSON.FeatureCollection;
}> {
  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json` +
    `&stateCd=${encodeURIComponent(stateCd.toLowerCase())}` +
    `&parameterCd=00060,00065&siteStatus=active&siteType=ST`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = await res.json();
  const timeSeries = data?.value?.timeSeries || [];
  const readings: LiveReading[] = [];
  const features: GeoJSON.Feature[] = [];

  for (const ts of timeSeries) {
    const src = ts.sourceInfo || {};
    const siteCode = src.siteCode?.[0]?.value || '';
    const siteName = src.siteName || siteCode;
    const geo = src.geoLocation?.geogLocation;
    const lon = geo ? Number(geo.longitude) : NaN;
    const lat = geo ? Number(geo.latitude) : NaN;
    const param = ts.variable?.variableName || ts.variable?.variableCode?.[0]?.value || '';
    const unit = ts.variable?.unit?.unitCode || '';
    const values = ts.values?.[0]?.value || [];
    const last = values[values.length - 1];
    if (!last) continue;
    readings.push({
      siteName,
      siteCode,
      parameter: param,
      value: String(last.value),
      unit,
      time: last.dateTime || '',
    });
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    features.push({
      type: 'Feature',
      properties: {
        name: siteName,
        siteCode,
        parameter: param,
        value: last.value,
        unit,
        time: last.dateTime,
        state: stateCd,
      },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    });
  }

  return {
    readings: readings.slice(0, 40),
    geojson: { type: 'FeatureCollection', features },
  };
}

/** Recent IV history for one site (last ~2 days of discharge) */
async function fetchUsgsSiteHistory(siteCode: string): Promise<HistoryPoint[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 19);
  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json` +
    `&sites=${encodeURIComponent(siteCode)}` +
    `&parameterCd=00060&startDT=${fmt(start)}&endDT=${fmt(end)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const values = data?.value?.timeSeries?.[0]?.values?.[0]?.value || [];
  // downsample to ~24 points
  const step = Math.max(1, Math.floor(values.length / 24));
  const pts: HistoryPoint[] = [];
  for (let i = 0; i < values.length; i += step) {
    pts.push({ time: values[i].dateTime, value: String(values[i].value) });
  }
  return pts;
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
    state: false,
    gauges: true,
  });
  const [stateLayers, setStateLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(US_STATES.map((s) => [s.code, false]))
  );
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [showStates, setShowStates] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [liveReadings, setLiveReadings] = useState<LiveReading[]>([]);
  const [gaugeGeo, setGaugeGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveState, setLiveState] = useState('PA');
  const [tick, setTick] = useState(0);

  const toggleLayer = useCallback((id: CoreLayerId) => {
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleState = useCallback((code: string) => {
    setStateLayers((prev) => ({ ...prev, [code]: !prev[code] }));
  }, []);

  const refreshLive = useCallback(async (stateCd: string) => {
    setLiveLoading(true);
    try {
      const { readings, geojson } = await fetchUsgsStateLive(stateCd);
      setLiveReadings(readings);
      setGaugeGeo(geojson);
      setLastRefresh(new Date());
    } catch (e) {
      console.warn('USGS live fetch failed', e);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  // Initial + every 5 minutes
  useEffect(() => {
    refreshLive(liveState);
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      refreshLive(liveState);
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [liveState, refreshLive]);

  const onMapClick = useCallback(async (e: MapLayerMouseEvent) => {
    const feat = e.features?.[0];
    if (!feat?.properties) {
      setPopup(null);
      return;
    }
    const props = feat.properties as Record<string, unknown>;
    setPopup({
      longitude: e.lngLat.lng,
      latitude: e.lngLat.lat,
      properties: props,
    });
    setSelected(props);
    setHistory([]);

    // If USGS gauge, load history
    const siteCode = String(props.siteCode || '');
    if (siteCode) {
      try {
        const pts = await fetchUsgsSiteHistory(siteCode);
        setHistory(pts);
      } catch {
        /* ignore */
      }
    }
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
    if (layers.gauges) ids.push('gauge-points');
    for (const s of US_STATES) {
      if (stateLayers[s.code]) ids.push(`state-${s.code}-points`);
    }
    return ids;
  }, [layers, stateLayers]);

  const enabledStateCount = useMemo(
    () => Object.values(stateLayers).filter(Boolean).length,
    [stateLayers]
  );

  const refreshLabel = lastRefresh
    ? `Live USGS · ${lastRefresh.toLocaleTimeString()} · every 5 min`
    : liveLoading
      ? 'Loading USGS live…'
      : 'USGS live pending';

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
          {/* Selected feature detail — high contrast white panel */}
          {selected && (
            <div className="section">
              <div className="section-title">Selected feature</div>
              <div className="detail-panel">
                <h3>{featureTitle(selected)}</h3>
                {prettyProps(selected).map(([k, v]) => (
                  <div key={k} className="meta-row">
                    <span className="meta-key">{k}</span>
                    <span className="meta-val">{v}</span>
                  </div>
                ))}
                <div className="detail-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setSelected(null);
                      setHistory([]);
                      setPopup(null);
                    }}
                  >
                    Clear
                  </button>
                  {selected.siteCode && (
                    <a
                      className="btn-primary"
                      href={`https://waterdata.usgs.gov/monitoring-location/${selected.siteCode}/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      USGS site page
                    </a>
                  )}
                  {selected.PWSID && (
                    <a
                      className="btn-primary"
                      href={`https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/200?P200_PWSID=${selected.PWSID}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      EPA SDWIS
                    </a>
                  )}
                  {selected.nidId && (
                    <a
                      className="btn-primary"
                      href="https://nid.sec.usace.army.mil/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      NID portal
                    </a>
                  )}
                </div>

                {(history.length > 0 || selected.siteCode) && (
                  <div className="live-box">
                    <h4>Near real-time / recent history</h4>
                    {history.length === 0 ? (
                      <div>Loading recent discharge…</div>
                    ) : (
                      <ul className="history-list">
                        {history.map((h, i) => (
                          <li key={i}>
                            <span>{new Date(h.time).toLocaleString()}</span>
                            <strong>{h.value} cfs</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.68rem', color: '#64748b' }}>
                      USGS Instantaneous Values (provisional). Water utility rates are not
                      published as a live national feed — see local tariffs / PUC.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="section">
            <div className="section-title">National snapshot</div>
            <div className="kpi-grid">
              <div className="kpi">
                <div className="kpi-label">Withdrawals</div>
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
                <div className="kpi-label">Avg rate</div>
                <div className="kpi-value">
                  ~$5.15 <span className="kpi-unit">/1k gal</span>
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">NID dams</div>
                <div className="kpi-value">
                  92.8k <span className="kpi-unit">pts</span>
                </div>
              </div>
            </div>
            <p className="refresh-hint">
              Live gauges refresh every 5 minutes (USGS IV). Infrastructure inventories
              update less often (EPA / NID). Tick #{tick}.
            </p>
          </div>

          <div className="section">
            <div className="section-title">Search</div>
            <div className="search-box">
              <input
                type="text"
                placeholder="City, ZIP, landmark…"
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
            <div className="section-title">Live USGS gauges (state)</div>
            <div className="search-box">
              <select
                value={liveState}
                onChange={(e) => setLiveState(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0f2744',
                  border: '1px solid #1e3a5f',
                  borderRadius: 6,
                  color: '#e0f2fe',
                  padding: '0.4rem',
                }}
              >
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => refreshLive(liveState)} disabled={liveLoading}>
                {liveLoading ? '…' : 'Refresh'}
              </button>
            </div>
            <label className="layer-item" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={layers.gauges}
                onChange={() => toggleLayer('gauges')}
              />
              <span className="layer-swatch" style={{ background: LAYER_COLORS.gauges }} />
              <span className="layer-label">Show gauges on map</span>
              <span className="layer-count">{liveReadings.length} series</span>
            </label>
          </div>

          <div className="section">
            <div className="section-title">National layers</div>
            <div className="layer-list">
              {(
                [
                  { id: 'cws' as CoreLayerId, label: 'CWS systems (national)', note: '~41k' },
                  { id: 'dams' as CoreLayerId, label: 'All NID dams', note: '92k' },
                  { id: 'wwtp' as CoreLayerId, label: 'WWTP Majors', note: '2k' },
                  { id: 'pa_pws' as CoreLayerId, label: 'PA service polygons', note: 'DEP' },
                  { id: 'wwtp_pa' as CoreLayerId, label: 'PA WWTP', note: '~974' },
                  { id: 'aqueducts' as CoreLayerId, label: 'Aqueducts', note: 'sample' },
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
              State CWS (default OFF)
              <button
                type="button"
                onClick={() => setShowStates((v) => !v)}
                style={{
                  marginLeft: 6,
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
              <div className="layer-list" style={{ maxHeight: 240, overflowY: 'auto' }}>
                {US_STATES.map((s) => (
                  <label key={s.code} className="layer-item">
                    <input
                      type="checkbox"
                      checked={!!stateLayers[s.code]}
                      onChange={() => toggleState(s.code)}
                    />
                    <span className="layer-swatch" style={{ background: LAYER_COLORS.state }} />
                    <span className="layer-label">
                      {s.name} ({s.code})
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-title">Legend</div>
            <div className="layer-list">
              {layers.cws && (
                <div className="layer-item">
                  <span className="layer-swatch" style={{ background: LAYER_COLORS.cws }} />
                  <span className="layer-label">CWS national</span>
                </div>
              )}
              {layers.dams && (
                <div className="layer-item">
                  <span className="layer-swatch" style={{ background: LAYER_COLORS.dams }} />
                  <span className="layer-label">NID dams</span>
                </div>
              )}
              {layers.wwtp && (
                <div className="layer-item">
                  <span className="layer-swatch" style={{ background: LAYER_COLORS.wwtp }} />
                  <span className="layer-label">WWTP majors</span>
                </div>
              )}
              {layers.gauges && (
                <div className="layer-item">
                  <span className="layer-swatch" style={{ background: LAYER_COLORS.gauges }} />
                  <span className="layer-label">USGS gauges</span>
                </div>
              )}
              {layers.pa_pws && (
                <div className="layer-item">
                  <span className="layer-swatch" style={{ background: LAYER_COLORS.pa_pws }} />
                  <span className="layer-label">PA polygons</span>
                </div>
              )}
              {enabledStateCount > 0 && (
                <div className="layer-item">
                  <span className="layer-swatch" style={{ background: LAYER_COLORS.state }} />
                  <span className="layer-label">State CWS ({enabledStateCount})</span>
                </div>
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-title">Costs (not live)</div>
            <div className="costs-panel">
              <div className="row">
                <span>National avg</span>
                <span>$3.85 / CCF</span>
              </div>
              <div className="row">
                <span>≈ per 1,000 gal</span>
                <span>$5.15</span>
              </div>
              <p className="note">
                Utility rates are not available as a national real-time API. Click a
                feature for inventory metadata and USGS stream history where available.
              </p>
            </div>
          </div>
        </div>

        <div className="status-bar">
          <span className={`status-dot${lastRefresh ? '' : ' stale'}`} />
          {refreshLabel}
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

          {layers.gauges && gaugeGeo && (
            <Source id="gauges" type="geojson" data={gaugeGeo}>
              <Layer
                id="gauge-points"
                type="circle"
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 8, 6, 12, 9],
                  'circle-color': LAYER_COLORS.gauges,
                  'circle-stroke-width': 1.2,
                  'circle-stroke-color': '#422006',
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
              maxWidth="300px"
            >
              <div className="water-popup">
                <h3>{featureTitle(popup.properties)}</h3>
                {prettyProps(popup.properties)
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <div key={k} className="meta-row">
                      <span className="meta-key">{k}</span>
                      <span className="meta-val">{v}</span>
                    </div>
                  ))}
                <div className="hint">Full metadata → left panel</div>
              </div>
            </Popup>
          )}
        </Map>

        <div className="map-legend">
          <div className="map-legend-title">Active</div>
          {layers.cws && (
            <div className="map-legend-item">
              <span className="map-legend-swatch" style={{ background: LAYER_COLORS.cws }} />
              CWS
            </div>
          )}
          {layers.dams && (
            <div className="map-legend-item">
              <span className="map-legend-swatch" style={{ background: LAYER_COLORS.dams }} />
              Dams
            </div>
          )}
          {layers.wwtp && (
            <div className="map-legend-item">
              <span className="map-legend-swatch" style={{ background: LAYER_COLORS.wwtp }} />
              WWTP
            </div>
          )}
          {layers.gauges && (
            <div className="map-legend-item">
              <span className="map-legend-swatch" style={{ background: LAYER_COLORS.gauges }} />
              Gauges
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
