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
  
  // Estados para selección múltiple
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [todoSeleccionado, setTodoSeleccionado] = useState(false);

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

  useEffect(() => {
    setSeleccionados(new Set());
    setTodoSeleccionado(false);
  }, [analisisFiltrados]);

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
        setSeleccionados(new Set());
        setTodoSeleccionado(false);
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
        cargarCarpetas();
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

  const toggleSeleccion = (id) => {
    const nuevoSet = new Set(seleccionados);
    if (nuevoSet.has(id)) {
      nuevoSet.delete(id);
    } else {
      nuevoSet.add(id);
    }
    setSeleccionados(nuevoSet);
    setTodoSeleccionado(nuevoSet.size === analisisFiltrados.length);
  };

  const toggleTodos = () => {
    if (todoSeleccionado) {
      setSeleccionados(new Set());
      setTodoSeleccionado(false);
    } else {
      const nuevosSeleccionados = new Set(analisisFiltrados.map(a => a.id));
      setSeleccionados(nuevosSeleccionados);
      setTodoSeleccionado(true);
    }
  };

  const eliminarSeleccionados = async () => {
    if (seleccionados.size === 0) {
      alert('No hay análisis seleccionados');
      return;
    }

    if (!window.confirm(`¿Estás seguro de que quieres eliminar ${seleccionados.size} análisis? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      let eliminados = 0;
      let errores = 0;

      for (const id of seleccionados) {
        const response = await fetch(`http://localhost:5000/api/analisis/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          eliminados++;
        } else {
          errores++;
        }
      }

      if (eliminados > 0) {
        alert(`Se eliminaron ${eliminados} análisis exitosamente${errores > 0 ? ` (${errores} errores)` : ''}`);
        setSeleccionados(new Set());
        setTodoSeleccionado(false);
        if (carpetaSeleccionada) {
          cargarAnalisisCarpeta(carpetaSeleccionada.id);
        }
      }
    } catch (error) {
      console.error('Error al eliminar análisis:', error);
      alert('Error de conexión al eliminar los análisis');
    }
  };

  if (loading && carpetas.length === 0) {
    return (
      <div className="historial-container">
        <h2>📋 Historial de Análisis</h2>
        <div className="loading-message">Cargando carpetas...</div>
      </div>
    );
  }

  if (error && carpetas.length === 0) {
    return (
      <div className="historial-container">
        <h2>📋 Historial de Análisis</h2>
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
      <h2>📋 Historial de Análisis</h2>
      
      <div className="carpetas-container">
        <div className="carpetas-header">
          <h4>📁 Carpetas</h4>
          <button
            onClick={() => setMostrarFormCarpeta(!mostrarFormCarpeta)}
            className="btn-nueva-carpeta"
          >
            {mostrarFormCarpeta ? 'Cancelar' : '+ Nueva'}
          </button>
        </div>

        {mostrarFormCarpeta && (
          <form onSubmit={crearCarpeta} className="form-nueva-carpeta">
            <input
              type="text"
              value={nombreNuevaCarpeta}
              onChange={(e) => setNombreNuevaCarpeta(e.target.value)}
              placeholder="Nombre de carpeta"
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
                  title="Eliminar"
                >
                  ❌
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {carpetaSeleccionada ? (
        <>
          <div className="carpeta-actual">
            <strong>{carpetaSeleccionada.nombre}</strong>
            <small>{analisis.length} análisis</small>
          </div>

          {analisis.length === 0 ? (
            <div className="no-data-message">
              <h3>Sin análisis</h3>
              <p>Esta carpeta está vacía</p>
            </div>
          ) : (
            <>
              <div className="filtros-container">
                <h4>Ordenar:</h4>
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
                    Elong. {filtroActivo === 'elongacion' && (ordenAscendente ? '↑' : '↓')}
                  </button>
                  <button 
                    onClick={() => cambiarFiltro('modulo')} 
                    className={`filtro-btn ${filtroActivo === 'modulo' ? 'activo' : ''}`}
                  >
                    Módulo {filtroActivo === 'modulo' && (ordenAscendente ? '↑' : '↓')}
                  </button>
                </div>
              </div>

              {analisisFiltrados.length > 0 && (
                <div className="barra-seleccion">
                  <div className="barra-left">
                    <input
                      type="checkbox"
                      id="check-todos"
                      checked={todoSeleccionado}
                      onChange={toggleTodos}
                      className="checkbox-todos"
                    />
                    <label htmlFor="check-todos" className="label-todos">
                      Todos ({seleccionados.size}/{analisisFiltrados.length})
                    </label>
                  </div>
                  {seleccionados.size > 0 && (
                    <button 
                      onClick={eliminarSeleccionados}
                      className="btn-eliminar-multiples"
                    >
                      🗑️ Eliminar ({seleccionados.size})
                    </button>
                  )}
                </div>
              )}

              <div className="tabla-responsive">
                <table className="tabla-analisis">
                  <thead>
                    <tr>
                      <th className="col-checkbox">✓</th>
                      <th>ID</th>
                      <th>Fecha</th>
                      <th>Usuario</th>
                      <th>Archivo</th>
                      <th>Área</th>
                      <th>Dist.</th>
                      <th>Tensión</th>
                      <th>Elong.</th>
                      <th>Módulo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analisisFiltrados.map((a) => (
                      <tr key={a.id} className={seleccionados.has(a.id) ? 'fila-seleccionada' : ''}>
                        <td className="col-checkbox">
                          <input
                            type="checkbox"
                            checked={seleccionados.has(a.id)}
                            onChange={() => toggleSeleccion(a.id)}
                            className="checkbox-fila"
                          />
                        </td>
                        <td className="id-column">{a.id}</td>
                        <td className="fecha-column">{formatearFecha(a.fecha_analisis)}</td>
                        <td className="usuario-column">{a.nombre_usuario}</td>
                        <td className="archivo-column" title={a.archivo_nombre}>
                          {a.archivo_nombre ? a.archivo_nombre.substring(0, 15) + '...' : 'N/A'}
                        </td>
                        <td className="numero-column">{a.area}</td>
                        <td className="numero-column">{a.distancia}</td>
                        <td className="numero-column">{a.tension_maxima?.toFixed(1) || 'N/A'}</td>
                        <td className="numero-column">{a.elongacion_ruptura?.toFixed(1) || 'N/A'}</td>
                        <td className="numero-column">{a.modulo_young?.toFixed(1) || 'N/A'}</td>
                        <td>
                          <div className="acciones-container">
                            <button
                              onClick={() => descargarCSV(a.id, a.archivo_nombre)}
                              className="btn-accion btn-descargar"
                              title="Descargar"
                            >
                              📄
                            </button>
                            
                            <Link 
                              to={`/reporte-analisis/${a.id}`}
                              className="btn-accion btn-reporte"
                              title="Reporte"
                            >
                              📊
                            </Link>

                            <button
                              onClick={() => eliminarAnalisis(a.id)}
                              className="btn-accion btn-eliminar"
                              title="Eliminar"
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
          <p>Elige una carpeta para ver sus análisis</p>
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
        🔄 Actualizar
      </button>
    </div>
  );
};

export default HistorialAnalisis;