import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
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
      
      // Detectar tipo de archivo
      const esExcel = archivo.name.endsWith('.xlsx') || archivo.name.endsWith('.xls');
      
      if (esExcel) {
        // Para Excel, leer como ArrayBuffer
        reader.onload = (e) => {
          try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const primeraHoja = workbook.SheetNames[0];
            const hoja = workbook.Sheets[primeraHoja];
            
            // Convertir a CSV
            const csv = XLSX.utils.sheet_to_csv(hoja, { blankrows: false });
            resolve(csv);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(archivo);
      } else {
        // Para CSV/TXT, leer como texto
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(archivo, 'UTF-8');
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResultados(null);

    try {
      if (!formData.archivo || !formData.carpeta_id) {
        setError("Faltan datos requeridos (archivo o carpeta)");
        setLoading(false);
        return;
      }

      const archivoOriginal = await leerArchivoOriginal(formData.archivo);
      
      // Validar que sea un archivo válido (CSV o Excel convertido a CSV)
      if (!archivoOriginal.includes(';') && !archivoOriginal.includes(',')) {
        setError("El archivo no parece ser un formato válido (CSV, XLS o XLSX)");
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
      console.error('Error:', error);
      setError('Error de conexión o al procesar el archivo');
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
          <label>Área (mm²): 
            <input type="number" step="0.01" name="area" value={formData.area} onChange={handleChange} />
          </label>
          <small>Opcional (toma del CSV si está vacío)</small>
        </div>

        <div className="form-group">
          <label>Distancia mordazas L₀ (mm): * 
            <input type="number" step="0.01" name="distancia" value={formData.distancia} onChange={handleChange} required />
          </label>
        </div>

        <div className="form-group">
          <label>Constante: 
            <input type="number" step="0.001" name="constante" value={formData.constante} onChange={handleChange} />
          </label>
        </div>

        <div className="form-group">
          <label>Archivo de Datos: * 
            <input 
              type="file" 
              name="archivo" 
              accept=".csv,.txt,.xls,.xlsx" 
              onChange={handleChange} 
              required 
            />
          </label>
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
            
            <div className="resultado-item" style={{
              padding: '15px',
              backgroundColor: 'white',
              borderRadius: '6px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                {resultados.elongacion_ruptura?.toFixed(2)} %
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Elongación de Ruptura
              </div>
            </div>
            
            <div className="resultado-item" style={{
              padding: '15px',
              backgroundColor: 'white',
              borderRadius: '6px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                {resultados.modulo_young?.toFixed(3)} MPa
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Módulo de Elasticidad (E)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisisForm;