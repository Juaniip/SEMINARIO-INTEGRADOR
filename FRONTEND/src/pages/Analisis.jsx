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
  const [mostrarFormCarpeta, setMostrarFormCarpeta] = useState(false);
  const [nombreCarpeta, setNombreCarpeta] = useState("");
  const [loadingCarpeta, setLoadingCarpeta] = useState(false);

  useEffect(() => {
    cargarCarpetas();
  }, []);

  const cargarCarpetas = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/carpetas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCarpetas(data);
      }
    } catch (error) { 
      console.error(error); 
    }
  };

  const crearCarpeta = async (e) => {
    if (e) e.preventDefault(); // Prevenir recarga si se pasa el evento
    
    if (!nombreCarpeta.trim()) {
      alert("Por favor ingresa un nombre para la carpeta");
      return;
    }

    setLoadingCarpeta(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/carpetas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nombre: nombreCarpeta.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setNombreCarpeta("");
        setMostrarFormCarpeta(false);
        cargarCarpetas();
        setFormData(prev => ({ ...prev, carpeta_id: data.id }));
        alert('Carpeta creada exitosamente');
      } else {
        alert(data.error || 'Error al crear carpeta');
      }
    } catch (error) {
      console.error('Error al crear carpeta:', error);
      alert('Error de conexión al crear carpeta');
    } finally {
      setLoadingCarpeta(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const leerArchivoOriginal = (archivo) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      const esExcel = archivo.name.endsWith('.xlsx') || archivo.name.endsWith('.xls');
      
      if (esExcel) {
        reader.onload = (e) => {
          try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const primeraHoja = workbook.SheetNames[0];
            const hoja = workbook.Sheets[primeraHoja];
            const csv = XLSX.utils.sheet_to_csv(hoja, { blankrows: false });
            resolve(csv);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(archivo);
      } else {
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
      
      if (!archivoOriginal.includes(';') && !archivoOriginal.includes(',')) {
        setError("El archivo no parece ser un formato válido (CSV, XLS o XLSX)");
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/analisis', {
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
            <div className="carpeta-select-container">
              <select 
                name="carpeta_id" 
                value={formData.carpeta_id} 
                onChange={handleChange} 
                required
              >
                <option value="">Selecciona una carpeta</option>
                {carpetas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button 
                type="button"
                className="btn-crear-carpeta-inline"
                onClick={() => setMostrarFormCarpeta(!mostrarFormCarpeta)}
                title="Crear nueva carpeta"
              >
                {mostrarFormCarpeta ? 'Cancelar' : 'Crear Carpeta'}
              </button>
            </div>
          </label>

          {mostrarFormCarpeta && (
            <div className="form-carpeta-inline">
              <input
                type="text"
                value={nombreCarpeta}
                onChange={(e) => setNombreCarpeta(e.target.value)}
                onKeyDown={(e) => {
                  // Detectamos Enter para enviar solo este campo
                  if (e.key === 'Enter') {
                    e.preventDefault(); 
                    crearCarpeta(e);
                  }
                }}
                placeholder="--Nombre de la carpeta--"
                className="input-carpeta-inline"
              />
              <button 
                type="button" // Tipo button para no enviar el form principal
                onClick={crearCarpeta}
                className="btn-enviar-carpeta"
                disabled={loadingCarpeta}
              >
                {loadingCarpeta ? 'Creando...' : 'Crear'}
              </button>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Área (mm²): 
            <input 
              type="number" 
              step="0.01" 
              name="area" 
              value={formData.area} 
              onChange={handleChange} 
              placeholder="--Opcional: toma el valor del archivo si está vacio--"
            />
          </label>
        </div>

        <div className="form-group">
          <label>Distancia entre mordazas L₀ (mm): * <input 
              type="number" 
              step="0.01" 
              name="distancia" 
              value={formData.distancia} 
              onChange={handleChange} 
              required 
            />
          </label>
        </div>

        <div className="form-group">
          <label>Constante: 
            <input 
              type="number" 
              step="0.001" 
              name="constante" 
              value={formData.constante} 
              onChange={handleChange} 
            />
          </label>
        </div>

        <div className="form-group">
          <label>Archivo de Datos: * <input 
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
          <h3> Resultados Obtenidos</h3>
          <div className="resultados-grid">
            <div className="resultado-item">
              <div className="res-valor" style={{color:'#007bff'}}>
                {resultados.tension_maxima?.toFixed(3)} MPa
              </div>
              <div className="res-label">Tensión Máxima</div>
            </div>
            
            <div className="resultado-item">
              <div className="res-valor" style={{color:'#28a737ff'}}>
                {resultados.elongacion_ruptura?.toFixed(2)} %
              </div>
              <div className="res-label">Elongación de Ruptura</div>
            </div>
            
            <div className="resultado-item">
              <div className="res-valor" style={{color:'#dc3545'}}>
                {resultados.modulo_young?.toFixed(3)} MPa
              </div>
              <div className="res-label">Módulo de Elasticidad</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisisForm;