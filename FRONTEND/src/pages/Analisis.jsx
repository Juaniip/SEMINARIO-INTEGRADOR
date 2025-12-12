import { useState, useEffect } from "react";
import "./AnalisisForm.css";

const AnalisisForm = ({ usuario }) => {
  const [formData, setFormData] = useState({
    area: "",
    distancia: "",
    constante: 0.949,
    archivo: null,
    carpeta_id: "",
  });
  const [carpetas, setCarpetas] = useState([]);
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarCarpetas();
  }, []);

  const cargarCarpetas = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('http://localhost:5000/api/carpetas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCarpetas(data);
        if (data.length > 0) setFormData(prev => ({ ...prev, carpeta_id: data[0].id }));
      }
    } catch (error) { console.error(error); }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const leerArchivoOriginal = (archivo) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(archivo, 'UTF-8');
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(""); setResultados(null);

    try {
      if (!formData.archivo || !formData.carpeta_id) {
        setError("Faltan datos requeridos (archivo o carpeta)");
        setLoading(false);
        return;
      }

      const archivoOriginal = await leerArchivoOriginal(formData.archivo);
      if (!archivoOriginal.includes('Archivo;') && !archivoOriginal.includes(';')) {
        setError("El archivo no es un CSV válido");
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/analisis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          area: formData.area ? parseFloat(formData.area) : null,
          distancia: parseFloat(formData.distancia),
          constante: parseFloat(formData.constante),
          carpeta_id: parseInt(formData.carpeta_id),
          archivo_nombre: formData.archivo.name,
          archivo_datos: archivoOriginal
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResultados(data.resultados);
        alert('Análisis procesado exitosamente.');
        setFormData({ ...formData, area: "", distancia: "", archivo: null });
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
      } else {
        setError(data.error || 'Error al procesar');
      }
    } catch (error) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analisis-container">
      <form className="analisis-form" onSubmit={handleSubmit}>
        <h2>Nuevo Análisis</h2>
        <div className="usuario-info"><strong>Usuario:</strong> {usuario || "Invitado"}</div>
        
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label>Carpeta: *
            <select name="carpeta_id" value={formData.carpeta_id} onChange={handleChange} required>
              <option value="">Selecciona una carpeta</option>
              {carpetas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        </div>

        <div className="form-group">
          <label>Área (mm²): <input type="number" step="0.01" name="area" value={formData.area} onChange={handleChange} /></label>
          <small>Opcional (toma del CSV si está vacío)</small>
        </div>

        <div className="form-group">
          <label>Distancia mordazas L₀ (mm): * <input type="number" step="0.01" name="distancia" value={formData.distancia} onChange={handleChange} required /></label>
        </div>

        <div className="form-group">
          <label>Constante: <input type="number" step="0.001" name="constante" value={formData.constante} onChange={handleChange} /></label>
        </div>

        <div className="form-group">
          <label>Archivo CSV: * <input type="file" name="archivo" accept=".csv,.txt" onChange={handleChange} required /></label>
        </div>

        <button type="submit" disabled={loading} className="btn-procesar">
          {loading ? 'Procesando...' : 'Calcular Propiedades'}
        </button>
      </form>

      {resultados && (
        <div className="resultados-container">
          <h3>✅ Resultados Obtenidos</h3>
          <div className="resultados-grid">
            <div className="resultado-item">
              <div className="res-valor" style={{color:'#007bff'}}>{resultados.tension_maxima?.toFixed(3)} MPa</div>
              <div className="res-label">Tensión Máxima</div>
            </div>
            <div className="resultado-item">
              {/* Aquí ahora usamos directamente elongacion_ruptura porque viene en % */}
              <div className="res-valor" style={{color:'#28a745'}}>{resultados.elongacion_ruptura?.toFixed(2)} %</div>
              <div className="res-label">Elongación Ruptura</div>
            </div>
            <div className="resultado-item">
              <div className="res-valor" style={{color:'#dc3545'}}>{resultados.modulo_young?.toFixed(3)} MPa</div>
              <div className="res-label">Módulo de Young</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisisForm;