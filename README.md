# WaterGridXplr

US water infrastructure explorer — themed from the PowerGridXplr template.

Dark, situational-awareness style map of **drinking water treatment**, **wastewater (influent/effluent) plants**, **dams & reservoirs**, **major aqueducts**, and hooks for water towers, mains, lift stations, force mains, and service areas.

**Legal & ethical only**: public documented APIs and open data exclusively. No scraping of private utility SCADA or proprietary OMS.

## Features

- Water droplet branding and blue EOC-style UI
- Layer toggles for wastewater treatment plants (WWTP), drinking water treatment plants, dams/reservoirs (NID), major aqueducts
- Clickable feature popups with metadata (name, capacity, influent/effluent, operator, state, etc.)
- National snapshot KPIs: USGS water-use withdrawals, approximate residential rates
- Location search (Nominatim / OpenStreetMap, proper User-Agent)
- Sample GeoJSON under `public/data/` so the map works out of the box
- Ready for GitHub Pages (`base: '/WaterGridXplr/'` — change in `vite.config.ts` if your repo name differs)

## Quick start

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
# deploy dist/ to GitHub Pages, Netlify, Cloudflare Pages, etc.
```

GitHub Actions workflow is included (`.github/workflows/deploy.yml`). Enable Pages on the repo (Settings → Pages → Source: GitHub Actions).

## Adding full national & state layers

Sample points/lines ship for demonstration. Real national coverage is large and fragmented. Recommended pattern (same as the power template):

1. Place simplified or region-split GeoJSON under `public/data/`
2. Wire `Source` / `Layer` in `src/App.tsx` behind the existing checkboxes (or add new ones)
3. Or query public ArcGIS FeatureServers / OGC APIs with a bounding-box filter when the map is zoomed in

### High-value public sources (national)

| Theme | Source | Notes |
|-------|--------|--------|
| **Drinking water systems / providers** | EPA SDWIS Fed, EPA DWMAPS | Community systems; intake locations often obscured for security |
| **Service area boundaries** | EPA / ORD Community Water Service Area Boundaries (~44k systems) | ArcGIS item; covers ~99% of consumers; mix of state-supplied + modeled |
| **Wastewater treatment plants** | EPA FRS + ICIS / NPDES, HIFLD Open archives | Publicly Owned Treatment Works; influent/effluent via permits |
| **Dams & reservoirs** | National Inventory of Dams (NID) — USACE | ~92k dams; height, storage, purpose, hazard class |
| **Hydrography / canals / aqueducts** | USGS National Hydrography Dataset (NHD), National Atlas canals & aqueducts | Medium/high-res flowlines; select artificial paths |
| **Watersheds** | USGS WBD (HUC) | Overlay only |
| **Real-time streamflow / gauges** | USGS National Water Dashboard / Water Data APIs | Not infrastructure points, but useful context |
| **Crowd-sourced utilities** | OpenStreetMap → Open Infrastructure Map | Generalized aqueducts, pipelines, water towers (`man_made=water_tower`, `pipeline`, etc.) |
| **Water use statistics** | USGS Circulars (e.g. 1441 for 2015) | Tabular by state/county; not live |
| **Rates / costs** | AWWA rate surveys, Circle of Blue, local utility tariffs, state PUC | No single national open GIS of retail rates |

HIFLD Open portal access has changed over time; check Data Rescue Project / Source Cooperative archives and data.gov mirrors for downloadable shapefiles / GeoJSON when the live hub is restricted.

### State & local examples (extend for all 50)

- **PA DEP** Public Water Supplier Service Areas (shapefiles)
- **Philadelphia** Water Department service line material map, stormwater parcel viewer
- **Chester County** water maps gallery (streams, floodplains, watersheds)
- Most states publish water/wastewater facility lists or GIS via DEQ / health departments / GIS hubs
- Search: `"[state] public water system GIS"`, `"[state] wastewater treatment plants shapefile"`, `"[state] dam inventory"`

Document additional state links in this README as you add them. Prefer official state open-data portals and EPA primacy agency pages.

### Layer ideas to add next

- Water towers / elevated storage (`man_made=water_tower` from OSM or local inventories)
- Major transmission mains / force mains (rarely complete nationally; local utilities + OSM)
- Lift stations (local collections)
- Desalination plants (Florida, California, Texas coastal lists)
- Reservoir polygons (NHD waterbodies + NID linkage)
- Sole-source aquifers / source-water protection areas (EPA DWMAPS layers)

## Metadata & popups

Click a feature to open a popup. Properties come straight from the GeoJSON attributes. When you replace samples with full datasets, keep clear property names (`name`, `capacity_mgd`, `influent`, `effluent`, `operator`, `state`, `nid_id`, etc.) so the generic popup remains useful. You can customize the popup renderer in `App.tsx` per layer.

## Water costs & usage panel

The sidebar shows approximate national averages and USGS withdrawal categories. These are **illustrative**. Authoritative numbers:

- Local utility rate schedules
- State public utility commissions
- USGS water-use publications
- AWWA and industry surveys

Store richer tables or state polygons in `public/data/water_costs_usage.json` (or additional GeoJSON) and bind them in the UI.

## Principles (carried from PowerGridXplr)

- Public documented APIs and open data only
- Respect rate limits and attribution (OSM ODbL, USGS, EPA, USACE)
- Typical data lag for live gauges is short; infrastructure inventories update annually or less often
- Not an official operations tool — cross-check critical decisions with utilities, state primacy agencies, EPA, and USACE

## Tech stack

- React 19 + Vite + TypeScript
- MapLibre GL + react-map-gl
- Carto Dark Matter basemap
- Sample data: GeoJSON in `public/data/`

## Disclaimer

For education and situational awareness. Infrastructure locations from open sources may be incomplete, generalized, or outdated. Security-sensitive features (exact intakes, critical valves) are often withheld by design. Always verify with official operators.

## License

Dashboard code: MIT (or as you prefer).  
Underlying datasets: follow each provider’s terms (public domain for many federal layers; ODbL for OSM-derived).

## Real data included in this build

| File | Source | Count |
|------|--------|-------|
| `nid_dams_full.geojson` | **Full USACE NID** via BTS NTAD | **92,766** dams |
| `cws_service_centroids.geojson` | **EPA Community Water System** service areas as centroids | **~41,000** systems |
| `wwtp_major.geojson` | EPA FRS + ICIS Wastewater Treatment Plants (Major) | 2,000 |
| `wwtp_pa.geojson` | EPA WWTP filtered to Pennsylvania | ~974 |
| `pa_pws_service_areas.geojson` | PA DEP eMapPA PWS service area **polygons** | 300 |
| `dams_high_hazard.geojson` | NID subset (hazard code 1) | 2,000 |

**Why centroids for CWS?** Full national service-area **polygons** (~44k complex multipolygons) are hundreds of MB and not practical as a single static GeoJSON for GitHub Pages. Centroids give a complete national facility/system layer with metadata (PWSID, population served, primacy agency, etc.). PA ships as real polygons as a state template; repeat the same query pattern for other state portals.

Endpoints used (public ArcGIS FeatureServers supporting GeoJSON):

- EPA WWTP: `https://services.arcgis.com/cJ9YHowT8TU7DUyn/ArcGIS/rest/services/FRS_Wastewater/FeatureServer/0`
- NID/NTAD Dams: `https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_Dams/FeatureServer/0`
- PA DEP: `https://gis.dep.pa.gov/depgisprd/rest/services/emappa/eMapPA_External_Extraction/FeatureServer/225`

To expand to all 50 states: page the FeatureServers with `resultOffset` / `resultRecordCount`, or download full national EPA Community Water System service-area boundaries and state shapefiles from PASDA-style portals. 811 locate services are one-call excavation networks, not infrastructure GIS. Do not scrape Google Maps; use OpenStreetMap / Open Infrastructure Map and official inventories instead.
