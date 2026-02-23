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
      // routeCoords is [[lat, lon], ...] from the server
      setRouteCoords(res.data.routeCoords || []);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") fetchRoute();
  };

  // Separate start, end and middle stations
  const startStation = stations[0];
  const endStation = stations[stations.length - 1];
  const midStations = stations.slice(1, -1);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>⚡ EV Route Planner</h1>
        <p style={styles.subtitle}>Find charging stations along your route</p>
        {searched && (
          <div style={{ background: '#333', color: '#fff', padding: '5px 10px', borderRadius: 5, fontSize: 12, display: 'inline-block', marginTop: 10 }}>
            Debug: {warnings.length} warnings found
          </div>
        )}
      </div>

      <div style={styles.searchBox}>
        <input
          style={styles.input}
          placeholder="📍 Start location (e.g. Bangalore)"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          style={styles.input}
          placeholder="🏁 End location (e.g. Mumbai)"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button style={styles.button} onClick={fetchRoute} disabled={loading}>
          {loading ? "🔄 Searching..." : "🔍 Find EV Stations"}
        </button>
      </div>

      {error && <div style={styles.error}>⚠ {error}</div>}

      {searched && (
        <div style={styles.stats}>
          ✅ Found <strong>{midStations.length}</strong> charging station(s) along the route
        </div>
      )}

      {/* Warnings moved up for better visibility */}
      {warnings && warnings.length > 0 && (
        <div style={styles.warningsBox} id="warnings-section">
          <h3 style={styles.warningsHeader}>🚨 Critical Range Warnings</h3>
          <p style={styles.warningsSub}>The following stretches have limited charging options. Please plan accordingly.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        </div>
      )}

      <div style={styles.mapWrapper}>
        <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />

          {/* Draw route polyline */}
          {routeCoords.length > 0 && (
            <>
              <Polyline
                positions={routeCoords}
                pathOptions={{ color: "#4f46e5", weight: 5, opacity: 0.8 }}
              />
              <FitBounds routeCoords={routeCoords} />
            </>
          )}

          {/* Start marker */}
          {startStation && (
            <Marker position={[startStation.lat, startStation.lon]} icon={startIcon}>
              <Popup><strong>🟢 {startStation.tags?.name || "Start"}</strong></Popup>
            </Marker>
          )}

          {/* End marker */}
          {endStation && stations.length > 1 && (
            <Marker position={[endStation.lat, endStation.lon]} icon={endIcon}>
              <Popup><strong>🔴 {endStation.tags?.name || "Destination"}</strong></Popup>
            </Marker>
          )}

          {/* EV Stations along route */}
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
      </div>

    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Segoe UI', sans-serif",
    maxWidth: 900,
    margin: "0 auto",
    padding: "20px",
    background: "#f0f4ff",
    minHeight: "100vh",
  },
  header: {
    textAlign: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    color: "#4f46e5",
    margin: 0,
  },
  subtitle: {
    color: "#666",
    marginTop: 6,
    fontSize: 15,
  },
  searchBox: {
    display: "flex",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    minWidth: 200,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #c7d2fe",
    fontSize: 15,
    outline: "none",
    background: "#fff",
    color: "#111",
  },
  button: {
    padding: "10px 22px",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    color: "#dc2626",
    background: "#fee2e2",
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 12,
  },
  stats: {
    color: "#166534",
    background: "#dcfce7",
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 15,
  },
  mapWrapper: {
    height: 520,
    borderRadius: 12,
    overflow: "hidden",
    border: "2px solid #c7d2fe",
    boxShadow: "0 4px 20px rgba(79,70,229,0.15)",
  },
  warningsBox: {
    marginTop: 20,
    background: "#fff7ed",
    border: "2px solid #fed7aa",
    borderRadius: 12,
    padding: "20px",
    boxShadow: "0 2px 10px rgba(251,146,60,0.1)",
  },
  warningsHeader: {
    margin: "0 0 6px 0",
    color: "#9a3412",
    fontSize: 18,
  },
  warningsSub: {
    margin: "0 0 16px 0",
    color: "#7c2d12",
    fontSize: 14,
    opacity: 0.8,
  },
  warningItem: {
    marginBottom: 10,
    padding: "12px 16px",
    background: "#ffedd5",
    borderLeft: "4px solid #f97316",
    borderRadius: 8,
    fontSize: 15,
    lineHeight: 1.6,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  criticalWarningItem: {
    marginBottom: 10,
    padding: "12px 16px",
    background: "#fee2e2",
    borderLeft: "4px solid #ef4444",
    borderRadius: 8,
    fontSize: 15,
    lineHeight: 1.6,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  warningIcon: {
    fontSize: 20,
    marginTop: 2,
  },
};