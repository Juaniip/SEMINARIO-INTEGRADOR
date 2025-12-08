import { Link } from "react-router-dom";
import './Home.css';

const Home = () => (
  <div className="page-container home-dashboard">
    
    {/* Sección 1: Bienvenida y Valor (Hero) */}
    <div className="hero-section">
      <h1>🔬 Plataforma de Análisis Mecánico de Biopolímeros</h1>
      <p>
        Optimiza la gestión de tus ensayos de tracción y determina con precisión 
        las propiedades clave (Tensión Máxima, Módulo de Young, Elongación) de 
        tus materiales biodegradables.
      </p>
    </div>

    {/* Sección 2: Acciones Rápidas (Cards) */}
    <div className="quick-actions-grid">
      
      <Link to="/analisis" className="action-card primary-card">
        <h3>Procesar Nuevo Ensayo</h3>
        <p>Sube tu archivo CSV y obtén resultados de Tensión-Deformación al instante.</p>
        <span className="card-icon">📈</span>
      </Link>
      
      <Link to="/registros" className="action-card secondary-card">
        <h3>Historial y Reportes</h3>
        <p>Accede a tus análisis guardados, carpetas, y descarga reportes detallados.</p>
        <span className="card-icon">📂</span>
      </Link>

    </div>
  </div>
);

export default Home;