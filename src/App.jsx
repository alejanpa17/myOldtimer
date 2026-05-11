import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import Home from "./pages/Home";
import VehicleInfo from "./pages/VehicleInfo";
import Diagnostics from "./pages/Diagnostics";
import Maintenance from "./pages/Maintenance";
import MaintenanceHistory from "./pages/MaintenanceHistory";
import ReplaceHistory from "./pages/ReplaceHistory";
import Checklist from "./pages/Checklist";
import AIChat from "./pages/AIChat";
import FaultCodes from "./pages/FaultCodes";
import FaultHistory from "./pages/FaultHistory";
import RelayTester from "./pages/RelayTester";
import PartsFinder from "./pages/PartsFinder";
import FuelEfficiency from "./pages/FuelEfficiency";

const NAV_ITEMS = [
  { to: "/", label: "Garage", icon: "garage", exact: true },
  { to: "/vehicle", label: "Vehicle", icon: "vehicle" },
  { to: "/maintenance", label: "Service", icon: "service" },
  { to: "/diagnostics", label: "Scan", icon: "scan" },
  { to: "/ai", label: "AI", icon: "ai" },
];

function NavIcon({ name }) {
  switch (name) {
    case "vehicle":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5.3 10.2 7 6.4A2.4 2.4 0 0 1 9.2 5h5.6A2.4 2.4 0 0 1 17 6.4l1.7 3.8 1.1.4c.7.2 1.2.9 1.2 1.7V17a1 1 0 0 1-1 1h-1.2a2.3 2.3 0 0 1-4.4 0H9.6a2.3 2.3 0 0 1-4.4 0H4a1 1 0 0 1-1-1v-4.7c0-.8.5-1.5 1.2-1.7l1.1-.4Zm2.1-.4h9.2l-1-2.3a.9.9 0 0 0-.8-.5H9.2a.9.9 0 0 0-.8.5l-1 2.3Zm-.1 7.6a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm9.4 0a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z" />
        </svg>
      );
    case "service":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M19.5 13.4c.1-.5.1-.9.1-1.4s0-.9-.1-1.4l2-1.5-1.9-3.3-2.4 1a7.4 7.4 0 0 0-2.4-1.4L14.5 3h-5l-.4 2.4c-.9.3-1.7.8-2.4 1.4l-2.3-1-2 3.3 2 1.5c-.1.5-.1.9-.1 1.4s0 .9.1 1.4l-2 1.5 2 3.3 2.3-1c.7.6 1.5 1.1 2.4 1.4l.4 2.4h5l.4-2.4c.9-.3 1.7-.8 2.4-1.4l2.4 1 1.9-3.3-2.1-1.5ZM12 15.4a3.4 3.4 0 1 1 0-6.8 3.4 3.4 0 0 1 0 6.8Z" />
        </svg>
      );
    case "scan":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5v-9Zm3.5-1.6a1.6 1.6 0 0 0-1.6 1.6v9a1.6 1.6 0 0 0 1.6 1.6h9a1.6 1.6 0 0 0 1.6-1.6v-9a1.6 1.6 0 0 0-1.6-1.6h-9Zm1.2 4.2h6.6v1.8H8.7v-1.8Zm0 3.3h3.8v1.8H8.7v-1.8Z" />
        </svg>
      );
    case "ai":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2.5 13.8 8l5.7 1.9-5.7 1.9L12 17.5l-1.8-5.7-5.7-1.9L10.2 8 12 2.5Zm6.2 11 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1v-9.2Z" />
        </svg>
      );
  }
}

function App() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const routeKey =
    location.key ||
    `${location.pathname}${location.search}${location.hash}`;
  const transitionClass =
    navigationType === "POP"
      ? "route-transition-back"
      : "route-transition-forward";

  return (
    <>
      <div key={routeKey} className={`route-transition ${transitionClass}`}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/vehicle" element={<VehicleInfo />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/diagnostics/fault-codes" element={<FaultCodes />} />
          <Route path="/diagnostics/fault-history" element={<FaultHistory />} />
          <Route path="/diagnostics/relay-tester" element={<RelayTester />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/maintenance/history" element={<MaintenanceHistory />} />
          <Route path="/maintenance/replace" element={<ReplaceHistory />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/parts-finder" element={<PartsFinder />} />
          <Route path="/fuel-efficiency" element={<FuelEfficiency />} />
          <Route path="/ai" element={<AIChat />} />
        </Routes>
      </div>
      <nav className="bottom-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              className={`bottom-nav-item ${isActive ? "bottom-nav-item-active" : ""}`}
              to={item.to}
              aria-current={isActive ? "page" : undefined}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export default App;
