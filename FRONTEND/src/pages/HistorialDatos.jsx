import { useState, useEffect } from "react";
import "./Historial.css";

const HistorialDatos = () => {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarDatosRelevantes();
  }, []);

  const cargarDatosRelevantes = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("No hay sesión activa");
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:5000/api/datos-relevantes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setDatos(data);
      } else {
        setError(data.error || 'Error al cargar datos relevantes');
      }
    } catch (error) {
      console.error('Error al cargar datos relevantes:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const descargarPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/datos-relevantes/pdf', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `datos_relevantes_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        
        alert('Archivo HTML descargado. Puedes abrirlo en el navegador y guardarlo como PDF usando Ctrl+P → Guardar como PDF');
      } else {
        alert('Error al generar el reporte PDF');
      }
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      alert('Error de conexión al generar el reporte');
    }
  };

  const formatearFecha = (fechaString) => {
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-AR') + ' ' + fecha.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="historial-container">
        <h2>Historial de Datos Relevantes</h2>
        <div className="loading-message">Cargando datos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="historial-container">
        <h2>Historial de Datos Relevantes</h2>
        <div className="error-message">
          <strong>Error:</strong> {error}
          <br />
          <button onClick={cargarDatosRelevantes} className="btn-actualizar" style={{ marginTop: '15px' }}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="historial-container">
      <style>{`
        .datos-relevantes-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 25px !important;
          padding: 20px !important;
          background: #f8f9fa !important;
          border-radius: 8px !important;
          border: 1px solid #dee2e6 !important;
        }
        .datos-relevantes-header h2 {
          margin: 0 !important;
          color: #333 !important;
        }
        .btn-pdf {
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%) !important;
          color: white !important;
          border: none !important;
          padding: 12px 20px !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 2px 4px rgba(220,53,69,0.3) !important;
        }
        .btn-pdf:hover {
          background: linear-gradient(135deg, #c82333 0%, #a71e2a 100%) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 8px rgba(220,53,69,0.4) !important;
        }
        .resumen-datos {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
          gap: 15px !important;
          margin-bottom: 30px !important;
        }
        .resumen-item {
          background: white !important;
          padding: 20px !important;
          border-radius: 8px !important;
          text-align: center !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
          border: 1px solid #e9ecef !important;
        }
        .resumen-valor {
          font-size: 24px !important;
          font-weight: bold !important;
          color: #007bff !important;
          margin-bottom: 5px !important;
        }
        .resumen-label {
          font-size: 12px !important;
          color: #666 !important;
          text-transform: uppercase !important;
          font-weight: 600 !important;
        }
        .tabla-responsive {
          width: 100% !important;
          overflow-x: auto !important;
          margin: 25px 0 !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
          border: 1px solid #dee2e6 !important;
        }
        .tabla-analisis {
          width: 100% !important;
          min-width: 1000px !important;
          border-collapse: collapse !important;
          background: white !important;
          font-size: 13px !important;
        }
        .tabla-analisis th {
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%) !important;
          color: white !important;
          font-weight: 600 !important;
          padding: 15px 10px !important;
          text-align: center !important;
          border-bottom: 2px solid #0056b3 !important;
          font-size: 12px !important;
          white-space: nowrap !important;
        }
        .tabla-analisis td {
          padding: 12px 8px !important;
          border-bottom: 1px solid #f1f3f4 !important;
          font-size: 12px !important;
          text-align: center !important;
          vertical-align: middle !important;
        }
        .tabla-analisis tbody tr:hover {
          background-color: #f8f9fa !important;
        }
        .tabla-analisis tbody tr:nth-child(even) {
          background-color: #fafbfc !important;
        }
        .btn-actualizar {
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%) !important;
          color: white !important;
          border: none !important;
          padding: 12px 25px !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          margin-top: 25px !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 2px 4px rgba(0,123,255,0.3) !important;
        }
      `}</style>

      <div className="datos-relevantes-header">
        <h2>Historial de Datos Relevantes</h2>
        <button onClick={descargarPDF} className="btn-pdf">
          📄 Descargar PDF
        </button>
      </div>

      {datos.length === 0 ? (
        <div className="no-data-message">
          <h3>No hay datos disponibles</h3>
          <p>Realiza algunos análisis para ver los datos relevantes aquí</p>
        </div>
      ) : (
        <>
          {/* Resumen rápido */}
          <div className="resumen-datos">
            <div className="resumen-item">
              <div className="resumen-valor">{datos.length}</div>
              <div className="resumen-label">Total Análisis</div>
            </div>
            <div className="resumen-item">
              <div className="resumen-valor">
                {Math.max(...datos.map(d => d.tension_maxima || 0)).toFixed(2)}
              </div>
              <div className="resumen-label">Máx Tensión (MPa)</div>
            </div>
            <div className="resumen-item">
              <div className="resumen-valor">
                {Math.max(...datos.map(d => d.elongacion_ruptura || 0)).toFixed(2)}
              </div>
              <div className="resumen-label">Máx Elongación (mm)</div>
            </div>
            <div className="resumen-item">
              <div className="resumen-valor">
                {Math.max(...datos.map(d => d.modulo_young || 0)).toFixed(2)}
              </div>
              <div className="resumen-label">Máx Módulo Young (MPa)</div>
            </div>
          </div>

          {/* Tabla detallada */}
          <div className="tabla-responsive">
            <table className="tabla-analisis">
              <thead>
                <tr>
                  <th>ID Análisis</th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Tensión Máxima (MPa)</th>
                  <th>Elongación Ruptura (mm)</th>
                  <th>Módulo Young (MPa)</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 'bold', color: '#007bff' }}>{d.id}</td>
                    <td style={{ fontSize: '11px' }}>{formatearFecha(d.fecha_analisis)}</td>
                    <td>{d.nombre_usuario}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: '500' }}>
                      {d.tension_maxima ? d.tension_maxima.toFixed(3) : 'N/A'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: '500' }}>
                      {d.elongacion_ruptura ? d.elongacion_ruptura.toFixed(3) : 'N/A'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: '500' }}>
                      {d.modulo_young ? d.modulo_young.toFixed(3) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <button 
        onClick={cargarDatosRelevantes}
        className="btn-actualizar"
      >
        Actualizar Datos
      </button>
    </div>
  );
};

export default HistorialDatos;