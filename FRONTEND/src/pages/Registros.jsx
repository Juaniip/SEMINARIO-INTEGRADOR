import { Link } from "react-router-dom";
import "./Registros.css";

const Registros = () => {
  return (
    <div className="registros-container">
      <h2>Registros</h2>
      <div className="opciones">
        <Link to="/historial-analisis" className="registro-btn">
          Historial de Análisis
        </Link>
        <Link to="/historial-datos" className="registro-btn">
          Historial de Datos Relevantes
        </Link>
      </div>
    </div>
  );
};

export default Registros;
