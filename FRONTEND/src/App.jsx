import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import AnalisisForm from './pages/Analisis';
import Registros from './pages/Registros';
import HistorialAnalisis from './pages/HistorialAnalisis';
import HistorialDatos from './pages/HistorialDatos';
import ReporteAnalisis from './pages/ReporteAnalisis';
import Contacto from './pages/Contacto';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usuario, setUsuario] = useState('');

  // Verificar si hay una sesión guardada al cargar la app
  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioGuardado = localStorage.getItem('usuario');
    
    if (token && usuarioGuardado) {
      setIsAuthenticated(true);
      setUsuario(JSON.parse(usuarioGuardado).usuario);
    }
  }, []);

  const handleLogin = (nombreUsuario) => {
    setIsAuthenticated(true);
    setUsuario(nombreUsuario);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsuario('');
    // El localStorage se limpia en el componente Navbar
  };

  return (
    <div className="App">
      <Navbar 
        isAuthenticated={isAuthenticated} 
        onLogout={handleLogout}
        usuario={usuario}
      />
      
      <main style={{ minHeight: '80vh', padding: '20px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route 
            path="/login" 
            element={<Login onLogin={handleLogin} />} 
          />
          <Route 
            path="/analisis" 
            element={isAuthenticated ? <AnalisisForm usuario={usuario} /> : <Login onLogin={handleLogin} />} 
          />
          <Route 
            path="/registros" 
            element={isAuthenticated ? <Registros /> : <Login onLogin={handleLogin} />} 
          />
          <Route 
            path="/historial-analisis" 
            element={isAuthenticated ? <HistorialAnalisis /> : <Login onLogin={handleLogin} />} 
          />
          <Route 
            path="/historial-datos" 
            element={isAuthenticated ? <HistorialDatos /> : <Login onLogin={handleLogin} />} 
          />
          <Route 
            path="/reporte-analisis/:id" 
            element={isAuthenticated ? <ReporteAnalisis /> : <Login onLogin={handleLogin} />} 
          />
          <Route path="/contacto" element={<Contacto />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;