import { useState } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons broken by webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom icons
const evIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2554/2554940.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const startIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const endIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684912.png",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

// Component to auto-fit map bounds to route
function FitBounds({ routeCoords }) {
  const map = useMap();
  if (routeCoords && routeCoords.length > 0) {
    const bounds = L.latLngBounds(routeCoords);
    map.fitBounds(bounds, { padding: [40, 40] });
  }
  return null;
}

export default function App() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [stations, setStations] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  const fetchRoute = async () => {
    if (!start.trim() || !end.trim()) {
      setError("Please enter both start and end locations.");
      return;
    }
    setLoading(true);
    setError("");
    setStations([]);
    setWarnings([]);
    setRouteCoords([]);
    setSearched(false);

    try {
      const res = await axios.get(
        `http://localhost:5000/api/route?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      );

      console.log("API Response:", res.data);
      setStations(res.data.stations || []);
      setWarnings(res.data.warnings || []);
      setRouteCoords(res.data.routeCoords || []);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startStation = stations[0];
  const endStation = stations[stations.length - 1];
  const midStations = stations.slice(1, -1);

  return (
    <div style={styles.appWrapper}>
      {/* Full-screen map */}
      <MapContainer center={[20.5937, 78.9629]} zoom={5} style={styles.map}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />

        {routeCoords.length > 0 && (
          <>
            <Polyline
              positions={routeCoords}
              pathOptions={{ color: "#4f46e5", weight: 5, opacity: 0.8 }}
            />
            <FitBounds routeCoords={routeCoords} />
          </>
        )}

        {startStation && (
          <Marker position={[startStation.lat, startStation.lon]} icon={startIcon}>
            <Popup><strong>🟢 {startStation.tags?.name || "Start"}</strong></Popup>
          </Marker>
        )}

        {endStation && stations.length > 1 && (
          <Marker position={[endStation.lat, endStation.lon]} icon={endIcon}>
            <Popup><strong>🔴 {endStation.tags?.name || "Destination"}</strong></Popup>
          </Marker>
        )}

        {midStations.map((s, i) => (
          <Marker key={s.id || i} position={[s.lat, s.lon]} icon={evIcon}>
            <Popup>
              <strong>⚡ {s.tags?.name || "EV Charging Station"}</strong>
              {s.tags?.operator && <><br />🏢 {s.tags.operator}</>}
              {s.tags?.["socket:type2"] && <><br />🔌 Type 2: {s.tags["socket:type2"]} port(s)</>}
              {s.tags?.fee && <><br />💰 Fee: {s.tags.fee}</>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Overlay panel */}
      <div style={styles.overlay}>
        <div style={styles.panel}>
          <div style={styles.header}>
            <h1 style={styles.title}>⚡ EV Route Planner</h1>
            <p style={styles.subtitle}>Find charging stations along your route</p>
          </div>

          <div style={styles.searchBox}>
            <input
              style={styles.input}
              placeholder="Start location"
              value={start}
              onChange={e => setStart(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchRoute()}
            />
            <input
              style={styles.input}
              placeholder="End location"
              value={end}
              onChange={e => setEnd(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchRoute()}
            />
            <button style={styles.button} onClick={fetchRoute} disabled={loading}>
              {loading ? "Searching..." : "Find Route"}
            </button>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          {searched && !error && (
            <div style={styles.stats}>
              ✅ Found <strong>{stations.length}</strong> charging station(s) along your route.
              {warnings.length > 0 && (
                <button
                  style={styles.warningToggle}
                  onClick={() => setShowWarnings(v => !v)}
                >
                  ⚠ {warnings.length} Warning{warnings.length > 1 ? "s" : ""} {showWarnings ? "▲" : "▼"}
                </button>
              )}
            </div>
          )}

          {showWarnings && warnings.length > 0 && (
            <div style={styles.warningsBox}>
              <h3 style={styles.warningsHeader}>⚠ Coverage Gaps</h3>
              <p style={styles.warningsSub}>Stretches with limited or no charging stations</p>
              {warnings.map((w, i) => (
                <div key={i} style={w.distanceKm > 200 ? styles.criticalWarningItem : styles.warningItem}>
                  <div style={styles.warningIcon}>{w.distanceKm > 200 ? "🧨" : "⚠"}</div>
                  <div>
                    <strong>{w.distanceKm} km</strong> gap between <em>{w.from}</em> and <em>{w.to}</em>
                    <br />
                    <span style={{ color: "#7c2d12", fontSize: 13 }}>
                      💡 Suggested charge: <strong>{w.suggestedChargeTime}</strong> before this stretch.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  appWrapper: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
  },
  map: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 0,
  },
  overlay: {
    position: "absolute",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 1000,
    width: "100%",
    maxWidth: 600,
    padding: "0 16px",
    boxSizing: "border-box",
    pointerEvents: "none",
  },
  panel: {
    background: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(8px)",
    borderRadius: 16,
    padding: "16px 20px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
    pointerEvents: "all",
  },
  header: {
    textAlign: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    color: "#4f46e5",
    margin: 0,
  },
  subtitle: {
    color: "#666",
    marginTop: 4,
    marginBottom: 0,
    fontSize: 13,
  },
  searchBox: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    minWidth: 160,
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #c7d2fe",
    fontSize: 14,
    outline: "none",
    background: "#fff",
    color: "#111",
  },
  button: {
    padding: "9px 18px",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  error: {
    color: "#dc2626",
    background: "#fee2e2",
    padding: "8px 12px",
    borderRadius: 8,
    marginTop: 10,
    fontSize: 14,
  },
  stats: {
    color: "#166534",
    background: "#dcfce7",
    padding: "8px 12px",
    borderRadius: 8,
    marginTop: 10,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  warningToggle: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 6,
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: 13,
    color: "#9a3412",
    fontWeight: 600,
  },
  warningsBox: {
    marginTop: 10,
    background: "#fff7ed",
    border: "2px solid #fed7aa",
    borderRadius: 12,
    padding: "12px 16px",
    maxHeight: 220,
    overflowY: "auto",
  },
  warningsHeader: {
    margin: "0 0 4px 0",
    color: "#9a3412",
    fontSize: 16,
  },
  warningsSub: {
    margin: "0 0 10px 0",
    color: "#7c2d12",
    fontSize: 13,
    opacity: 0.8,
  },
  warningItem: {
    marginBottom: 8,
    padding: "10px 14px",
    background: "#ffedd5",
    borderLeft: "4px solid #f97316",
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 1.6,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  criticalWarningItem: {
    marginBottom: 8,
    padding: "10px 14px",
    background: "#fee2e2",
    borderLeft: "4px solid #ef4444",
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 1.6,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  warningIcon: {
    fontSize: 18,
    marginTop: 2,
  },
};