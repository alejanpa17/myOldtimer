import { Routes, Route } from "react-router-dom";
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

function App() {
  return (
    <Routes>
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
  );
}

export default App;
