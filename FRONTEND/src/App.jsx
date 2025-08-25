import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Analisis from "./pages/Analisis";
import Registros from "./pages/Registros";
import Contacto from "./pages/Contacto";
import Login from "./pages/Login";
import Footer from "./components/Footer";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => setIsAuthenticated(true);

  return (
    <div>
      <Navbar isAuthenticated={isAuthenticated} />
      <Routes>
        <Route path="/" element={<Home />} />
        {isAuthenticated && <Route path="/analisis" element={<Analisis />} />}
        {isAuthenticated && <Route path="/registros" element={<Registros />} />}
        <Route path="/contacto" element={<Contacto />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
      </Routes>
      <Footer className="footer" />
    </div>
  );
}

export default App;

