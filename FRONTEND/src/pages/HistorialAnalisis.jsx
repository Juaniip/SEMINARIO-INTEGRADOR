import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./HistorialAnalisis.css";

const HistorialAnalisis = () => {
  const [analisis, setAnalisis] = useState([]);
  const [analisisFiltrados, setAnalisisFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Estados para filtros
  const [filtroActivo, setFiltroActivo] = useState('fecha');
  const [ordenAscendente, setOrdenAscendente] = useState(false);

  useEffect(() => {
    cargarHistorial();
  }, []);

  useEffect(() => {
    aplicarFiltro();
  }, [analisis, filtroActivo, ordenAscendente]);

  const cargarHistorial = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("No hay sesión activa");
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:5000/api/analisis', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setAnalisis(data);
      } else {
        setError(data.error || 'Error al cargar historial');
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltro = () => {
    let analisisiOrdenados = [...analisis];
    
    analisisiOrdenados.sort((a, b) => {
      let valorA, valorB;
      
      switch (filtroActivo) {
        case 'fecha':
          valorA = new Date(a.fecha_analisis);
          valorB = new Date(b.fecha_analisis);
          break;
        case 'archivo':
          valorA = (a.archivo_nombre || '').toLowerCase();
          valorB = (b.archivo_nombre || '').toLowerCase();
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

    setAnalisisFiltrados(analisisiOrdenados);
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

  const descargarCSV = async (id, nombreArchivo) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/analisis/${id}/descargar-csv`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo || `archivo_original_${id}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Error al descargar el archivo CSV');
      }
    } catch (error) {
      console.error('Error al descargar CSV:', error);
      alert('Error de conexión al descargar el archivo');
    }
  };

  const eliminarAnalisis = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este análisis? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/analisis/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Análisis eliminado exitosamente');
        cargarHistorial(); // Recargar la lista
      } else {
        const data = await response.json();
        alert(data.error || 'Error al eliminar el análisis');
      }
    } catch (error) {
      console.error('Error al eliminar análisis:', error);
      alert('Error de conexión al eliminar el análisis');
    }
  };

  if (loading) {
    return (
      <div className="historial-container">
        <h2>Historial de Análisis</h2>
        <div className="loading-message">Cargando análisis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="historial-container">
        <h2>Historial de Análisis</h2>
        <div className="error-message">
          <strong>Error:</strong> {error}
          <br />
          <button onClick={cargarHistorial} className="btn-actualizar" style={{ marginTop: '15px' }}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="historial-container">
      <h2>Historial de Análisis</h2>
      
      {analisis.length === 0 ? (
        <div className="no-data-message">
          <h3>No hay análisis registrados</h3>
          <p>Sube tu primer análisis desde la sección "Análisis"</p>
        </div>
      ) : (
        <>
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
                onClick={() => cambiarFiltro('archivo')} 
                className={`filtro-btn ${filtroActivo === 'archivo' ? 'activo' : ''}`}
              >
                Archivo {filtroActivo === 'archivo' && (ordenAscendente ? '↑' : '↓')}
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

          {/* Tabla de análisis */}
          <div className="tabla-responsive">
            <table className="tabla-analisis">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Archivo</th>
                  <th>Área (mm²)</th>
                  <th>Distancia (mm)</th>
                  <th>Tensión Máx (MPa)</th>
                  <th>Elongación (mm)</th>
                  <th>Módulo Young (MPa)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {analisisFiltrados.map((a) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>{formatearFecha(a.fecha_analisis)}</td>
                    <td>{a.nombre_usuario}</td>
                    <td title={a.archivo_nombre}>{a.archivo_nombre || 'N/A'}</td>
                    <td>{a.area}</td>
                    <td>{a.distancia}</td>
                    <td>{a.tension_maxima?.toFixed(2) || 'N/A'}</td>
                    <td>{a.elongacion_ruptura?.toFixed(2) || 'N/A'}</td>
                    <td>{a.modulo_young?.toFixed(2) || 'N/A'}</td>
                    <td>
                      <div className="acciones-container">
                        <button
                          onClick={() => descargarCSV(a.id, a.archivo_nombre)}
                          className="btn-accion btn-descargar"
                          title="Descargar archivo CSV original"
                        >
                          📄
                        </button>
                        
                        <Link 
                          to={`/reporte-analisis/${a.id}`}
                          className="btn-accion btn-reporte"
                          title="Ver reporte completo con gráficas"
                        >
                          📊
                        </Link>

                        <button
                          onClick={() => eliminarAnalisis(a.id)}
                          className="btn-accion btn-eliminar"
                          title="Eliminar análisis"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      
      <button 
        onClick={cargarHistorial}
        className="btn-actualizar"
      >
        Actualizar
      </button>
    </div>
  );
};

export default HistorialAnalisis;