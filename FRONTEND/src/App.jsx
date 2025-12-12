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
import AdminUsuarios from './pages/AdminUsuarios';
import './App.css'; // Asegúrate de importar el CSS aquí

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [usuarioData, setUsuarioData] = useState(null);

  // Verificar si hay una sesión guardada al cargar la app
  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioGuardado = localStorage.getItem('usuario');
    
    if (token && usuarioGuardado) {
      const userData = JSON.parse(usuarioGuardado);
      setIsAuthenticated(true);
      setUsuario(userData.usuario);
      setUsuarioData(userData);
    }
  }, []);

  const handleLogin = (nombreUsuario, userData) => {
    setIsAuthenticated(true);
    setUsuario(nombreUsuario);
    setUsuarioData(userData);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsuario('');
    setUsuarioData(null);
  };

  return (
    <div className="App">
      <Navbar 
        isAuthenticated={isAuthenticated} 
        onLogout={handleLogout}
        usuario={usuario}
        usuarioData={usuarioData}
      />
      
      {/* Clase aplicada para ocupar el espacio restante */}
      <main className="main-content">
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
          <Route 
            path="/admin/usuarios" 
            element={isAuthenticated && usuarioData?.rol === 'administrador' ? 
              <AdminUsuarios /> : 
              <Login onLogin={handleLogin} />
            } 
          />
          <Route path="/contacto" element={<Contacto />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;