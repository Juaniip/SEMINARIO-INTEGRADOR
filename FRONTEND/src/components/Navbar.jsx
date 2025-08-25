import { Link } from "react-router-dom";
import "./Navbar.css";

const Navbar = ({ isAuthenticated }) => {
  return (
    <nav className="navbar">
      <div className="logo">Análisis y Procesamiento de propiedades Mecánicas</div>
      <div className="links">
        {isAuthenticated && <Link to="/analisis" className="link">Analisis</Link>}
        {isAuthenticated && <Link to="/registros" className="link">Registros</Link>}
        <Link to="/contacto" className="link">Contacto</Link>
        <Link to="/login" className="link">Iniciar Sesion</Link>
      </div>
    </nav>
  );
};

export default Navbar;
