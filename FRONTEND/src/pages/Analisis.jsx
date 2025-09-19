import { useState, useEffect } from "react";
import "./AnalisisForm.css";

const AnalisisForm = ({ usuario }) => {
  const [formData, setFormData] = useState({
    area: "",
    distancia: "",
    constante: 0.949,
    archivo: null,
    carpeta_id: "", // Nuevo campo
  });
  const [carpetas, setCarpetas] = useState([]); // Estado para carpetas
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Cargar carpetas al montar el componente
  useEffect(() => {
    cargarCarpetas();
  }, []);

  const cargarCarpetas = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:5000/api/carpetas', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCarpetas(data);
        // Seleccionar automáticamente la carpeta "General" si existe
        const carpetaGeneral = data.find(c => c.nombre === 'General');
        if (carpetaGeneral) {
          setFormData(prev => ({ ...prev, carpeta_id: carpetaGeneral.id }));
        }
      }
    } catch (error) {
      console.error('Error al cargar carpetas:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  // FUNCIÓN CORREGIDA: Leer archivo como texto sin procesar
  const leerArchivoOriginal = (archivo) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        // IMPORTANTE: Leer como texto plano, NO como JSON
        const contenidoOriginal = e.target.result;
        console.log('=== FRONTEND DEBUGGING ===');
        console.log('Archivo leído:', archivo.name);
        console.log('Tamaño:', archivo.size, 'bytes');
        console.log('Primeros 200 caracteres:', contenidoOriginal.substring(0, 200));
        console.log('¿Es CSV?', contenidoOriginal.includes('Archivo;') || contenidoOriginal.includes(';'));
        console.log('========================');
        resolve(contenidoOriginal);
      };
      reader.onerror = reject;
      // CRÍTICO: Leer como texto, no como array buffer o data URL
      reader.readAsText(archivo, 'UTF-8');
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResultados(null);

    try {
      if (!formData.archivo) {
        setError("Por favor selecciona un archivo CSV");
        setLoading(false);
        return;
      }

      if (!formData.carpeta_id) {
        setError("Por favor selecciona una carpeta");
        setLoading(false);
        return;
      }

      // Leer el archivo original sin procesar
      const archivoOriginal = await leerArchivoOriginal(formData.archivo);

      // Verificar que es un archivo CSV válido
      if (!archivoOriginal.includes('Archivo;') && !archivoOriginal.includes(';')) {
        setError("El archivo no parece ser un CSV válido de la máquina de ensayos");
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setError("No hay sesión activa. Por favor, inicie sesión.");
        setLoading(false);
        return;
      }

      console.log('Enviando al backend:', {
        area: formData.area,
        distancia: formData.distancia,
        constante: formData.constante,
        carpeta_id: formData.carpeta_id,
        archivo_nombre: formData.archivo.name,
        archivo_datos_tipo: typeof archivoOriginal,
        archivo_datos_preview: archivoOriginal.substring(0, 100)
      });

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
          archivo_datos: archivoOriginal // ← ARCHIVO CSV ORIGINAL COMO STRING
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResultados(data.resultados);
        alert('Análisis procesado exitosamente. ID: ' + data.id);
        
        // Limpiar formulario
        setFormData({
          area: "",
          distancia: "",
          constante: 0.949,
          archivo: null,
          carpeta_id: formData.carpeta_id, // Mantener la carpeta seleccionada
        });
        // Limpiar input de archivo
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
        
      } else {
        setError(data.error || 'Error al procesar el análisis');
      }
    } catch (error) {
      console.error('Error al enviar análisis:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analisis-container">
      <form className="analisis-form" onSubmit={handleSubmit}>
        <h2>Formulario de Análisis</h2>

        <div className="usuario-info">
          <strong>Usuario:</strong> {usuario || "Invitado"}
        </div>

        {error && (
          <div className="error-message" style={{
            color: 'red',
            marginBottom: '15px',
            padding: '12px',
            border: '1px solid red',
            borderRadius: '4px',
            backgroundColor: '#ffe6e6'
          }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label>
            Carpeta: *
            <select
              name="carpeta_id"
              value={formData.carpeta_id}
              onChange={handleChange}
              required
              style={{
                display: 'block',
                width: '100%',
                marginTop: '0.4rem',
                padding: '0.6rem',
                fontSize: '0.95rem',
                border: '1px solid #ccc',
                borderRadius: '6px',
                backgroundColor: 'white'
              }}
            >
              <option value="">Selecciona una carpeta</option>
              {carpetas.map(carpeta => (
                <option key={carpeta.id} value={carpeta.id}>
                  {carpeta.nombre} ({carpeta.total_analisis} análisis)
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-group">
          <label>
            Área de los especímenes (mm²):
            <input
              type="number"
              step="0.01"
              name="area"
              value={formData.area}
              onChange={handleChange}
              placeholder="Déjalo vacío para usar el área del archivo"
            />
          </label>
          <small style={{ color: '#666', fontSize: '12px' }}>
            Si no especificas el área, se usará la del archivo CSV (recomendado)
          </small>
        </div>

        <div className="form-group">
          <label>
            Distancia entre mordazas (mm): *
            <input
              type="number"
              step="0.01"
              name="distancia"
              value={formData.distancia}
              onChange={handleChange}
              required
              placeholder="Ej: 22"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Constante:
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
          <label>
            Subir archivo CSV de la máquina de ensayos: *
            <input
              type="file"
              name="archivo"
              accept=".csv,.txt"
              onChange={handleChange}
              required
            />
          </label>
          <small style={{ color: '#666', fontSize: '12px' }}>
            Selecciona el archivo CSV generado por la máquina de tracción uniaxial
          </small>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{
            backgroundColor: loading ? '#cccccc' : '#007bff',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            padding: '12px 25px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: '500',
            marginTop: '20px',
            width: '100%'
          }}
        >
          {loading ? 'Procesando análisis...' : 'Procesar Análisis'}
        </button>
      </form>

      {resultados && (
        <div className="resultados-container" style={{
          marginTop: '30px',
          padding: '25px',
          border: '2px solid #28a745',
          borderRadius: '8px',
          backgroundColor: '#f8fff9'
        }}>
          <h3 style={{ color: '#28a745', marginTop: 0 }}>✅ Resultados del Análisis</h3>
          
          <div className="resultados-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginTop: '20px'
          }}>
            <div className="resultado-item" style={{
              padding: '15px',
              backgroundColor: 'white',
              borderRadius: '6px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                {resultados.tension_maxima?.toFixed(3)} MPa
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Tensión Máxima
              </div>
            </div>
            
            <div className="resultado-item" style={{
              padding: '15px',
              backgroundColor: 'white',
              borderRadius: '6px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                {resultados.elongacion_ruptura?.toFixed(3)} mm
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
                Módulo de Young
              </div>
            </div>
          </div>

          <div style={{ 
            marginTop: '20px', 
            textAlign: 'center',
            padding: '15px',
            backgroundColor: '#e3f2fd',
            borderRadius: '6px'
          }}>
            <strong>💡 Próximos pasos:</strong><br />
            Ve a "Registros" → "Historial de Análisis" para descargar el CSV original o ver el reporte completo con gráficas.
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisisForm;