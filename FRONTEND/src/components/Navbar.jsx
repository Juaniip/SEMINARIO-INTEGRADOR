import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

const Navbar = ({ isAuthenticated, onLogout, usuario, usuarioData }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    onLogout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">🧪 Sistema de Análisis</Link>
      </div>
      
      <ul className="navbar-menu">
        <li><Link to="/">Inicio</Link></li>
        
        {isAuthenticated ? (
          <>
            <li><Link to="/analisis">Análisis</Link></li>
            <li><Link to="/registros">Registros</Link></li>
            
            {/* Mostrar Administración solo si es administrador */}
            {usuarioData?.rol === 'administrador' && (
              <li><Link to="/admin/usuarios">👑 Administración</Link></li>
            )}
            
            <li><Link to="/contacto">Contacto</Link></li>
            <li className="user-info">
              <span>👤 {usuario} ({usuarioData?.rol || 'usuario'})</span>
            </li>
            <li>
              <button onClick={handleLogout} className="btn-logout">
                Cerrar Sesión
              </button>
            </li>
          </>
        ) : (
          <>
            <li><Link to="/contacto">Contacto</Link></li>
            <li><Link to="/login">Iniciar Sesión</Link></li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;