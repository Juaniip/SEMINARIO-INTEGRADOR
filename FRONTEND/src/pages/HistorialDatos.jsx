import { useState, useEffect } from "react";
import "./HistorialDatos.css";

const HistorialDatos = () => {
  const [carpetas, setCarpetas] = useState([]);
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState(null);
  const [datosAnalisis, setDatosAnalisis] = useState([]);
  const [datosAnalisisFiltrados, setDatosAnalisisFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);
  const [error, setError] = useState("");

  // Estados para filtros
  const [filtroActivo, setFiltroActivo] = useState('fecha');
  const [ordenAscendente, setOrdenAscendente] = useState(false);

  useEffect(() => {
    cargarDatosRelevantes();
  }, []);

  useEffect(() => {
    if (carpetaSeleccionada) {
      cargarAnalisisCarpeta(carpetaSeleccionada.carpeta_id);
    }
  }, [carpetaSeleccionada]);

  useEffect(() => {
    aplicarFiltro();
  }, [datosAnalisis, filtroActivo, ordenAscendente]);

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
        setCarpetas(data);
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

  const cargarAnalisisCarpeta = async (carpetaId) => {
    try {
      setLoadingAnalisis(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/datos-relevantes/${carpetaId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setDatosAnalisis(data);
      } else {
        setError(data.error || 'Error al cargar análisis de carpeta');
      }
    } catch (error) {
      console.error('Error al cargar análisis de carpeta:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoadingAnalisis(false);
    }
  };

  const aplicarFiltro = () => {
    let datosOrdenados = [...datosAnalisis];
    
    datosOrdenados.sort((a, b) => {
      let valorA, valorB;
      
      switch (filtroActivo) {
        case 'fecha':
          valorA = new Date(a.fecha_analisis);
          valorB = new Date(b.fecha_analisis);
          break;
        case 'usuario':
          valorA = (a.nombre_usuario || '').toLowerCase();
          valorB = (b.nombre_usuario || '').toLowerCase();
          break;
        case 'tension':
          valorA = a.tension_maxima || 0;
          valorB = b.tension_maxima || 0;
          break;
        case 'elongacion':
          valorA = a.elongacion_ruptura || 0;
          valorB = b.elongacion_ruptura || 0;
          break;
        case 'modulo':
          valorA = a.modulo_young || 0;
          valorB = b.modulo_young || 0;
          break;
        default:
          return 0;
      }

      if (valorA < valorB) return ordenAscendente ? -1 : 1;
      if (valorA > valorB) return ordenAscendente ? 1 : -1;
      return 0;
    });

    setDatosAnalisisFiltrados(datosOrdenados);
  };

  const cambiarFiltro = (nuevoFiltro) => {
    if (filtroActivo === nuevoFiltro) {
      setOrdenAscendente(!ordenAscendente);
    } else {
      setFiltroActivo(nuevoFiltro);
      setOrdenAscendente(true);
    }
  };

  const formatearFecha = (fechaString) => {
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-AR') + ' ' + fecha.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const volverACarpetas = () => {
    setCarpetaSeleccionada(null);
    setDatosAnalisis([]);
    setDatosAnalisisFiltrados([]);
  };

  if (loading) {
    return (
      <div className="historial-container">
        <h2>Historial de Datos Relevantes</h2>
        <div className="loading-message">Cargando datos...</div>
      </div>
    );
  }

  if (error && carpetas.length === 0) {
    return (
      <div className="historial-container">
        <h2>Historial de Datos Relevantes</h2>
        <div className="error-message">
          <strong>Error:</strong> {error}
          <br />
          <button onClick={cargarDatosRelevantes} className="btn-actualizar">
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="historial-container">
      <div className="datos-relevantes-header">
        <h2>Historial de Datos Relevantes</h2>
      </div>

      {/* Vista principal de carpetas */}
      {!carpetaSeleccionada && (
        <div className="carpetas-datos-container">
          <h4>Carpetas con Análisis:</h4>
          
          {carpetas.length === 0 ? (
            <div className="no-data-message">
              <h3>No hay carpetas con análisis</h3>
              <p>Realiza algunos análisis para ver los datos relevantes aquí</p>
            </div>
          ) : (
            <div className="carpetas-grid">
              {carpetas.map(carpeta => (
                <div 
                  key={carpeta.carpeta_id}
                  className="carpeta-card"
                  onClick={() => setCarpetaSeleccionada(carpeta)}
                >
                  <div className="carpeta-nombre">
                    📁 {carpeta.carpeta_nombre}
                    <small className="carpeta-hint">(Clic para ver detalles)</small>
                  </div>
                  <div className="carpeta-stats">
                    <div className="stat-item">
                      <span className="stat-label">Análisis:</span>
                      <span className="stat-value">{carpeta.total_analisis}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Tensión Promedio:</span>
                      <span className="stat-value">
                        {carpeta.avg_tension ? carpeta.avg_tension.toFixed(2) : 'N/A'} MPa
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Elongación Promedio:</span>
                      <span className="stat-value">
                        {carpeta.avg_elongacion ? carpeta.avg_elongacion.toFixed(2) : 'N/A'} mm
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Módulo Promedio:</span>
                      <span className="stat-value">
                        {carpeta.avg_modulo ? carpeta.avg_modulo.toFixed(2) : 'N/A'} MPa
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Máx Tensión:</span>
                      <span className="stat-value">
                        {carpeta.max_tension ? carpeta.max_tension.toFixed(2) : 'N/A'} MPa
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Máx Elongación:</span>
                      <span className="stat-value">
                        {carpeta.max_elongacion ? carpeta.max_elongacion.toFixed(2) : 'N/A'} mm
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vista de detalle de carpeta seleccionada */}
      {carpetaSeleccionada && (
        <>
          <button onClick={volverACarpetas} className="btn-volver">
            ← Volver a carpetas
          </button>

          <div className="carpeta-detalle-header">
            <strong>Análisis detallados de: {carpetaSeleccionada.carpeta_nombre}</strong>
            <br />
            <small>Total de análisis: {carpetaSeleccionada.total_analisis}</small>
          </div>

          {loadingAnalisis ? (
            <div className="loading-analisis">
              Cargando análisis de la carpeta...
            </div>
          ) : datosAnalisis.length > 0 ? (
            <>
              {/* Resumen rápido de la carpeta */}
              <div className="resumen-datos">
                <div className="resumen-item">
                  <div className="resumen-valor">{datosAnalisis.length}</div>
                  <div className="resumen-label">Total Análisis</div>
                </div>
                <div className="resumen-item">
                  <div className="resumen-valor">
                    {(datosAnalisis.reduce((sum, d) => sum + (d.tension_maxima || 0), 0) / datosAnalisis.length).toFixed(2)}
                  </div>
                  <div className="resumen-label">Promedio Tensión (MPa)</div>
                </div>
                <div className="resumen-item">
                  <div className="resumen-valor">
                    {(datosAnalisis.reduce((sum, d) => sum + (d.elongacion_ruptura || 0), 0) / datosAnalisis.length).toFixed(2)}
                  </div>
                  <div className="resumen-label">Promedio Elongación (mm)</div>
                </div>
                <div className="resumen-item">
                  <div className="resumen-valor">
                    {(datosAnalisis.reduce((sum, d) => sum + (d.modulo_young || 0), 0) / datosAnalisis.length).toFixed(2)}
                  </div>
                  <div className="resumen-label">Promedio Módulo Young (MPa)</div>
                </div>
              </div>

              {/* Controles de filtro */}
              <div className="filtros-container">
                <h4>Ordenar por:</h4>
                <div className="filtros-botones">
                  <button 
                    onClick={() => cambiarFiltro('fecha')} 
                    className={`filtro-btn ${filtroActivo === 'fecha' ? 'activo' : ''}`}
                  >
                    Fecha {filtroActivo === 'fecha' && (ordenAscendente ? '↑' : '↓')}
                  </button>
                  <button 
                    onClick={() => cambiarFiltro('usuario')} 
                    className={`filtro-btn ${filtroActivo === 'usuario' ? 'activo' : ''}`}
                  >
                    Usuario {filtroActivo === 'usuario' && (ordenAscendente ? '↑' : '↓')}
                  </button>
                  <button 
                    onClick={() => cambiarFiltro('tension')} 
                    className={`filtro-btn ${filtroActivo === 'tension' ? 'activo' : ''}`}
                  >
                    Tensión {filtroActivo === 'tension' && (ordenAscendente ? '↑' : '↓')}
                  </button>
                  <button 
                    onClick={() => cambiarFiltro('elongacion')} 
                    className={`filtro-btn ${filtroActivo === 'elongacion' ? 'activo' : ''}`}
                  >
                    Elongación {filtroActivo === 'elongacion' && (ordenAscendente ? '↑' : '↓')}
                  </button>
                  <button 
                    onClick={() => cambiarFiltro('modulo')} 
                    className={`filtro-btn ${filtroActivo === 'modulo' ? 'activo' : ''}`}
                  >
                    Módulo Young {filtroActivo === 'modulo' && (ordenAscendente ? '↑' : '↓')}
                  </button>
                </div>
              </div>

              {/* Tabla detallada de análisis individuales */}
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
                    {datosAnalisisFiltrados.map((d) => (
                      <tr key={d.id}>
                        <td className="id-column">{d.id}</td>
                        <td className="fecha-column">{formatearFecha(d.fecha_analisis)}</td>
                        <td>{d.nombre_usuario}</td>
                        <td className="numero-column">
                          {d.tension_maxima ? d.tension_maxima.toFixed(3) : 'N/A'}
                        </td>
                        <td className="numero-column">
                          {d.elongacion_ruptura ? d.elongacion_ruptura.toFixed(3) : 'N/A'}
                        </td>
                        <td className="numero-column">
                          {d.modulo_young ? d.modulo_young.toFixed(3) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="carpeta-vacia">
              <h3>No hay análisis en esta carpeta</h3>
              <p>Esta carpeta no contiene análisis todavía</p>
            </div>
          )}
        </>
      )}

      <button 
        onClick={cargarDatosRelevantes}
        className="btn-actualizar"
      >
        🔄 Actualizar Datos
      </button>
    </div>
  );
};

export default HistorialDatos;