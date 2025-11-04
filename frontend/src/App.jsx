import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AboutPage from "./pages/AboutPage";
import AlertPage from "./pages/AlertPage";
import DashboardPage from "./pages/DashboardPage";
import MapPage from "./pages/MapPage";
import ReportPage from "./pages/ReportPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/mapa" element={<MapPage />} />
        <Route path="/relato" element={<ReportPage />} />
        <Route path="/painel" element={<DashboardPage />} />
        <Route path="/alerta/:id" element={<AlertPage />} />
        <Route path="/sobre" element={<AboutPage />} />
      </Routes>
    </Layout>
  );
}
