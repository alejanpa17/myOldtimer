import { useEffect, useRef, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
} from "react-router-dom";
import Home from "./pages/Home";
import Garage from "./pages/Garage";
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
import Expenses from "./pages/Expenses";

const NAV_ITEMS = [
  { to: "/", label: "Garage", icon: "garage", exact: true },
  { to: "/maintenance", label: "Service", icon: "service" },
  { to: "/checklist", label: "Checklist", icon: "checklist" },
  { to: "/parts-finder", label: "Parts", icon: "parts" },
  { to: "/fuel-efficiency", label: "Fuel", icon: "fuel" },
  { to: "/ai", label: "AI", icon: "ai" },
];

function getLocationKey(location) {
  return (
    location.key ||
    `${location.pathname}${location.search}${location.hash}`
  );
}

function getNavIndex(pathname) {
  return NAV_ITEMS.findIndex((item) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to)
  );
}

function AppRoutes({ routeLocation }) {
  return (
    <Routes location={routeLocation}>
      <Route path="/" element={<Home />} />
      <Route path="/garage" element={<Garage />} />
      <Route path="/vehicle" element={<VehicleInfo />} />
      <Route path="/diagnosis" element={<Diagnostics />} />
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
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/ai" element={<AIChat />} />
    </Routes>
  );
}

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
          <path d="M21.1 6.1a5.5 5.5 0 0 1-7.2 6.9l-7.6 7.6a2.1 2.1 0 0 1-3-3l7.6-7.6A5.5 5.5 0 0 1 17.8 2.8l-3.2 3.2 3.4 3.4 3.1-3.3ZM4.7 19.2a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Z" />
        </svg>
      );
    case "scan":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5v-9Zm3.5-1.6a1.6 1.6 0 0 0-1.6 1.6v9a1.6 1.6 0 0 0 1.6 1.6h9a1.6 1.6 0 0 0 1.6-1.6v-9a1.6 1.6 0 0 0-1.6-1.6h-9Zm1.2 4.2h6.6v1.8H8.7v-1.8Zm0 3.3h3.8v1.8H8.7v-1.8Z" />
        </svg>
      );
    case "checklist":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7.8 6.7 5.7 8.8 4.4 7.5 3.2 8.7l2.5 2.5L9 7.9 7.8 6.7Zm3.2.1h9v1.8h-9V6.8Zm-3.2 6.5-2.1 2.1-1.3-1.3-1.2 1.2 2.5 2.5L9 14.5l-1.2-1.2Zm3.2.1h9v1.8h-9v-1.8Z" />
        </svg>
      );
    case "parts":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M10.6 4a6.6 6.6 0 0 1 5.2 10.7l4.5 4.5-1.3 1.3-4.5-4.5A6.6 6.6 0 1 1 10.6 4Zm0 1.9a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Z" />
        </svg>
      );
    case "fuel":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 3h8a1 1 0 0 1 1 1v16H5V4a1 1 0 0 1 1-1Zm1 2v5h6V5H7Zm10.8 1.2 2.5 2.5c.5.5.7 1.1.7 1.8V18a2.5 2.5 0 0 1-5 0v-4h-1.5v-2H18a1 1 0 0 0 1-1v-.5c0-.2-.1-.5-.3-.6l-2.3-2.3 1.4-1.4Z" />
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
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [leavingLocation, setLeavingLocation] = useState(null);
  const [routeDirection, setRouteDirection] = useState("forward");
  const displayLocationRef = useRef(location);
  const routeAnimationTimer = useRef(null);
  const routeAnimationFrame = useRef(null);
  const swipeStart = useRef(null);
  const activeNavIndex = getNavIndex(location.pathname);

  useEffect(() => {
    const currentLocation = displayLocationRef.current;
    if (getLocationKey(currentLocation) === getLocationKey(location)) {
      return;
    }

    if (routeAnimationTimer.current) {
      clearTimeout(routeAnimationTimer.current);
    }
    if (routeAnimationFrame.current) {
      cancelAnimationFrame(routeAnimationFrame.current);
    }

    const currentNavIndex = getNavIndex(currentLocation.pathname);
    const nextNavIndex = getNavIndex(location.pathname);
    const nextDirection =
      currentNavIndex !== -1 &&
      nextNavIndex !== -1 &&
      currentNavIndex !== nextNavIndex
        ? nextNavIndex > currentNavIndex
          ? "forward"
          : "back"
        : navigationType === "POP"
          ? "back"
          : "forward";

    routeAnimationFrame.current = requestAnimationFrame(() => {
      setRouteDirection(nextDirection);
      setLeavingLocation(currentLocation);
      setDisplayLocation(location);
      displayLocationRef.current = location;
      routeAnimationFrame.current = null;
      routeAnimationTimer.current = setTimeout(() => {
        setLeavingLocation(null);
        routeAnimationTimer.current = null;
      }, 280);
    });
  }, [location, navigationType]);

  useEffect(() => {
    return () => {
      if (routeAnimationTimer.current) {
        clearTimeout(routeAnimationTimer.current);
      }
      if (routeAnimationFrame.current) {
        cancelAnimationFrame(routeAnimationFrame.current);
      }
    };
  }, []);

  const handleTouchStart = (event) => {
    if (event.touches.length !== 1 || activeNavIndex === -1) {
      swipeStart.current = null;
      return;
    }

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("button, a, input, textarea, select, label, [role='button']")
    ) {
      swipeStart.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStart.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleTouchEnd = (event) => {
    if (!swipeStart.current || activeNavIndex === -1) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.current.x;
    const deltaY = touch.clientY - swipeStart.current.y;
    swipeStart.current = null;

    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);
    if (horizontalDistance < 64 || horizontalDistance < verticalDistance * 1.25) {
      return;
    }

    const nextIndex = deltaX < 0 ? activeNavIndex + 1 : activeNavIndex - 1;
    const nextItem = NAV_ITEMS[nextIndex];
    if (nextItem) {
      navigate(nextItem.to);
    }
  };

  return (
    <>
      <div
        className={`route-stage route-stage-${routeDirection} ${
          leavingLocation ? "route-stage-animating" : ""
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {leavingLocation && (
          <div
            key={`exit-${getLocationKey(leavingLocation)}`}
            className="route-page route-page-exit"
            aria-hidden="true"
          >
            <AppRoutes routeLocation={leavingLocation} />
          </div>
        )}
        <div
          key={`enter-${getLocationKey(displayLocation)}`}
          className="route-page route-page-enter"
        >
          <AppRoutes routeLocation={displayLocation} />
        </div>
      </div>
      <nav
        className="bottom-nav"
        aria-label="Primary navigation"
        style={{
          "--active-index": Math.max(activeNavIndex, 0),
          "--nav-count": NAV_ITEMS.length,
        }}
      >
        <span className="bottom-nav-dash" aria-hidden="true" />
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
