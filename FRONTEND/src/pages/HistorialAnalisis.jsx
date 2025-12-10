import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./HistorialAnalisis.css";

const HistorialAnalisis = () => {
  const [carpetas, setCarpetas] = useState([]);
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState(null);
  const [analisis, setAnalisis] = useState([]);
  const [analisisFiltrados, setAnalisisFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Estados para filtros
  const [filtroActivo, setFiltroActivo] = useState('fecha');
  const [ordenAscendente, setOrdenAscendente] = useState(false);
  
  // Estados para crear nueva carpeta
  const [mostrarFormCarpeta, setMostrarFormCarpeta] = useState(false);
  const [nombreNuevaCarpeta, setNombreNuevaCarpeta] = useState("");

  useEffect(() => {
    cargarCarpetas();
  }, []);

  useEffect(() => {
    if (carpetaSeleccionada) {
      cargarAnalisisCarpeta(carpetaSeleccionada.id);
    }
  }, [carpetaSeleccionada]);

  useEffect(() => {
    aplicarFiltro();
  }, [analisis, filtroActivo, ordenAscendente]);

  const cargarCarpetas = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("No hay sesión activa");
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:5000/api/carpetas', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setCarpetas(data);
        // Seleccionar automáticamente la primera carpeta disponible si existe
        if (data.length > 0) {
          setCarpetaSeleccionada(data[0]);
        }
      } else {
        setError(data.error || 'Error al cargar carpetas');
      }
    } catch (error) {
      console.error('Error al cargar carpetas:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const cargarAnalisisCarpeta = async (carpetaId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:5000/api/carpetas/${carpetaId}/analisis`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setAnalisis(data);
      } else {
        setError(data.error || 'Error al cargar análisis de carpeta');
      }
    } catch (error) {
      console.error('Error al cargar análisis de carpeta:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const crearCarpeta = async (e) => {
    e.preventDefault();
    
    if (!nombreNuevaCarpeta.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/carpetas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nombre: nombreNuevaCarpeta.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Carpeta creada exitosamente');
        setNombreNuevaCarpeta("");
        setMostrarFormCarpeta(false);
        cargarCarpetas(); // Recargar lista de carpetas
      } else {
        alert(data.error || 'Error al crear carpeta');
      }
    } catch (error) {
      console.error('Error al crear carpeta:', error);
      alert('Error de conexión al crear carpeta');
    }
  };

  const eliminarCarpeta = async (carpetaId, nombreCarpeta) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la carpeta "${nombreCarpeta}"? Solo se puede eliminar si está vacía.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/carpetas/${carpetaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Carpeta eliminada exitosamente');
        cargarCarpetas();
        // Si eliminamos la carpeta seleccionada, volver a la primera disponible
        if (carpetaSeleccionada?.id === carpetaId) {
          const otrasCarpetas = carpetas.filter(c => c.id !== carpetaId);
          setCarpetaSeleccionada(otrasCarpetas.length > 0 ? otrasCarpetas[0] : null);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Error al eliminar carpeta');
      }
    } catch (error) {
      console.error('Error al eliminar carpeta:', error);
      alert('Error de conexión al eliminar carpeta');
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
        if (carpetaSeleccionada) {
          cargarAnalisisCarpeta(carpetaSeleccionada.id);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Error al eliminar el análisis');
      }
    } catch (error) {
      console.error('Error al eliminar análisis:', error);
      alert('Error de conexión al eliminar el análisis');
    }
  };

  if (loading && carpetas.length === 0) {
    return (
      <div className="historial-container">
        <h2>Historial de Análisis</h2>
        <div className="loading-message">Cargando carpetas...</div>
      </div>
    );
  }

  if (error && carpetas.length === 0) {
    return (
      <div className="historial-container">
        <h2>Historial de Análisis</h2>
        <div className="error-message">
          <strong>Error:</strong> {error}
          <br />
          <button onClick={cargarCarpetas} className="btn-actualizar">
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="historial-container">
      <h2>Historial de Análisis</h2>
      
      {/* Sección de carpetas */}
      <div className="carpetas-container">
        <div className="carpetas-header">
          <h4>Carpetas:</h4>
          <button
            onClick={() => setMostrarFormCarpeta(!mostrarFormCarpeta)}
            className="btn-nueva-carpeta"
          >
            {mostrarFormCarpeta ? 'Cancelar' : '+ Nueva Carpeta'}
          </button>
        </div>

        {mostrarFormCarpeta && (
          <form onSubmit={crearCarpeta} className="form-nueva-carpeta">
            <input
              type="text"
              value={nombreNuevaCarpeta}
              onChange={(e) => setNombreNuevaCarpeta(e.target.value)}
              placeholder="Nombre de la carpeta"
              className="input-carpeta"
              required
            />
            <button type="submit" className="btn-crear-carpeta">
              Crear
            </button>
          </form>
        )}

        <div className="carpetas-lista">
          {carpetas.map(carpeta => (
            <div 
              key={carpeta.id} 
              className={`carpeta-item ${carpetaSeleccionada?.id === carpeta.id ? 'selected' : ''}`}
            >
              <span 
                onClick={() => setCarpetaSeleccionada(carpeta)}
                className="carpeta-nombre"
              >
                📁 {carpeta.nombre} ({carpeta.total_analisis})
              </span>
              {carpeta.nombre !== 'General' && (
                <button
                  onClick={() => eliminarCarpeta(carpeta.id, carpeta.nombre)}
                  className="btn-eliminar-carpeta"
                  title="Eliminar carpeta (solo si está vacía)"
                >
                  ❌
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contenido de la carpeta seleccionada */}
      {carpetaSeleccionada ? (
        <>
          <div className="carpeta-actual">
            <strong>Viendo análisis de: {carpetaSeleccionada.nombre}</strong>
            <br />
            <small>Total de análisis en esta carpeta: {analisis.length}</small>
          </div>

          {analisis.length === 0 ? (
            <div className="no-data-message">
              <h3>No hay análisis en esta carpeta</h3>
              <p>Crea un nuevo análisis y selecciona esta carpeta para guardarlo aquí</p>
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
                      <th>Elongación (%)</th>
                      <th>Módulo Young (MPa)</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analisisFiltrados.map((a) => (
                      <tr key={a.id}>
                        <td className="id-column">{a.id}</td>
                        <td className="fecha-column">{formatearFecha(a.fecha_analisis)}</td>
                        <td className="usuario-column">{a.nombre_usuario}</td>
                        <td className="archivo-column" title={a.archivo_nombre}>
                          {a.archivo_nombre || 'N/A'}
                        </td>
                        <td className="numero-column">{a.area}</td>
                        <td className="numero-column">{a.distancia}</td>
                        <td className="numero-column">{a.tension_maxima?.toFixed(2) || 'N/A'}</td>
                        <td className="numero-column">{a.elongacion_ruptura?.toFixed(2) || 'N/A'}</td>
                        <td className="numero-column">{a.modulo_young?.toFixed(2) || 'N/A'}</td>
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
        </>
      ) : (
        <div className="no-data-message">
          <h3>Selecciona una carpeta</h3>
          <p>Elige una carpeta de arriba para ver sus análisis</p>
        </div>
      )}
      
      <button 
        onClick={() => {
          cargarCarpetas();
          if (carpetaSeleccionada) {
            cargarAnalisisCarpeta(carpetaSeleccionada.id);
          }
        }}
        className="btn-actualizar"
      >
        Actualizar
      </button>
    </div>
  );
};

export default HistorialAnalisis;