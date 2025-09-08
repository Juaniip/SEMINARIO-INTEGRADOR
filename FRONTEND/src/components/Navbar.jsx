import { Link } from "react-router-dom";
import "./Navbar.css";

const Navbar = ({ isAuthenticated, onLogout, usuario }) => {
  
  const handleLogout = () => {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    
    // Llamar a la función onLogout del padre
    onLogout();
  };

  return (
    <nav className="navbar">
      <div className="logo">Análisis y Procesamiento de propiedades Mecánicas</div>
      <div className="links">
        {isAuthenticated && <Link to="/analisis" className="link">Análisis</Link>}
        {isAuthenticated && <Link to="/registros" className="link">Registros</Link>}
        <Link to="/contacto" className="link">Contacto</Link>
        
        {isAuthenticated ? (
          <div className="user-section">
            <span className="user-name">Hola, {usuario || 'Usuario'}</span>
            <button 
              onClick={handleLogout} 
              className="logout-btn"
            >
              Cerrar Sesión
            </button>
          </div>
        ) : (
          <Link to="/login" className="link">Iniciar Sesión</Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;