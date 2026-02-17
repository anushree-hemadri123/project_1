import { useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function App() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [stations, setStations] = useState([]);
  const [warnings, setWarnings] = useState([]);

  const fetchRoute = async () => {
    const res = await axios.get(
      `http://localhost:5000/api/route?start=${start}&end=${end}`
    );

    setStations(res.data.stations || []);
    setWarnings(res.data.warnings || []);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>EV Route Planner</h2>

      <input
        placeholder="Start"
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <input
        placeholder="End"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
      />
      <button onClick={fetchRoute}>Search</button>

      <div style={{ height: "500px", marginTop: 20 }}>
        <MapContainer center={[12.97, 77.59]} zoom={6} style={{ height: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {stations.map((s, i) => (
            <Marker key={i} position={[s.lat, s.lon]}>
              <Popup>{s.tags?.name || "EV Station"}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {warnings.map((w, i) => (
        <div key={i} style={{ color: "red", marginTop: 10 }}>
          ⚠ {w.message} between {w.from} and {w.to}  
          Charge for {w.suggestedChargeTime}
        </div>
      ))}
    </div>
  );
}
