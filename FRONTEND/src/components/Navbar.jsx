import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

const Navbar = ({ isAuthenticated, onLogout, usuario, usuarioData }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    onLogout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar-header">
        <div className="navbar-brand">
          <Link to="/">🧪 Sistema de Análisis</Link>
        </div>

        {/* Botón hamburguesa */}
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>
      </div>

      <ul className={`navbar-menu ${menuOpen ? "open" : ""}`}>
        <li><Link to="/" onClick={() => setMenuOpen(false)}>Inicio</Link></li>

        {isAuthenticated ? (
          <>
            <li><Link to="/analisis" onClick={() => setMenuOpen(false)}>Análisis</Link></li>
            <li><Link to="/registros" onClick={() => setMenuOpen(false)}>Registros</Link></li>

            {usuarioData?.rol === "administrador" && (
              <li><Link to="/admin/usuarios" onClick={() => setMenuOpen(false)}>👑 Administración</Link></li>
            )}

            <li><Link to="/contacto" onClick={() => setMenuOpen(false)}>Contacto</Link></li>

            <li className="user-info">
              <span>👤 {usuario} ({usuarioData?.rol})</span>
            </li>

            <li>
              <button className="btn-logout" onClick={handleLogout}>
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
