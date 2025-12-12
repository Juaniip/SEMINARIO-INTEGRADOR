import { useState, useEffect } from "react";
import "./AdminUsuarios.css";

const AdminUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  // Estados del formulario
  const [nuevoUsuario, setNuevoUsuario] = useState({
    usuario: "",
    password: "",
    rol: "usuario"
  });

  const usuarioActual = JSON.parse(localStorage.getItem('usuario') || '{}');

  useEffect(() => {
    // Verificar que el usuario actual es administrador
    if (usuarioActual.rol !== 'administrador') {
      setError("No tienes permisos para acceder a esta página");
      setLoading(false);
      return;
    }
    
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("No hay sesión activa");
        setLoading(false);
        return;
      }

      // ✅ CAMBIO: Usar /api/usuarios en lugar de /api/login
      const response = await fetch('http://localhost:5000/api/usuarios', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setUsuarios(data);
      } else {
        setError(data.error || 'Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNuevoUsuario(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const crearUsuario = async (e) => {
    e.preventDefault();

    if (!nuevoUsuario.usuario || !nuevoUsuario.password) {
      alert('Usuario y contraseña son requeridos');
      return;
    }

    if (nuevoUsuario.password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      // ✅ CAMBIO: Usar /api/usuarios para crear usuario
      const response = await fetch('http://localhost:5000/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(nuevoUsuario)
      });

      const data = await response.json();

      if (response.ok) {
        alert('Usuario creado exitosamente');
        setNuevoUsuario({
          usuario: "",
          password: "",
          rol: "usuario"
        });
        setMostrarFormulario(false);
        cargarUsuarios();
      } else {
        alert(data.error || 'Error al crear usuario');
      }
    } catch (error) {
      console.error('Error al crear usuario:', error);
      alert('Error de conexión al crear usuario');
    }
  };

  const eliminarUsuario = async (id, nombreUsuario) => {
    // Protección en el frontend también
    if (nombreUsuario === 'FORPW') {
      alert('🔐 El usuario FORPW es el administrador principal del sistema y está protegido contra eliminación por motivos de seguridad.');
      return;
    }

    if (!window.confirm(`¿Estás seguro de que quieres eliminar el usuario "${nombreUsuario}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      // ✅ CAMBIO: Usar /api/usuarios/:id para eliminar usuario
      const response = await fetch(`http://localhost:5000/api/usuarios/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Usuario eliminado exitosamente');
        cargarUsuarios();
      } else {
        const data = await response.json();
        alert(data.error || 'Error al eliminar usuario');
      }
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      alert('Error de conexión al eliminar usuario');
    }
  };

  const formatearFecha = (fechaString) => {
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-AR') + ' ' + fecha.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (usuarioActual.rol !== 'administrador') {
    return (
      <div className="admin-container">
        <div className="error-acceso">
          <h2>⛔ Acceso Denegado</h2>
          <p>No tienes permisos para acceder a esta página.</p>
          <p>Solo los administradores pueden gestionar usuarios.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-container">
        <h2>Administración de Usuarios</h2>
        <div className="loading-message">Cargando usuarios...</div>
      </div>
    );
  }

  if (error && usuarios.length === 0) {
    return (
      <div className="admin-container">
        <h2>Administración de Usuarios</h2>
        <div className="error-message">
          <strong>Error:</strong> {error}
          <br />
          <button onClick={cargarUsuarios} className="btn-reintentar">
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h2>👤 Administración de Usuarios</h2>
        <button
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          className="btn-nuevo-usuario"
        >
          {mostrarFormulario ? 'Cancelar' : '➕ Nuevo Usuario'}
        </button>
      </div>

      {/* Formulario para crear usuario */}
      {mostrarFormulario && (
        <div className="formulario-container">
          <h3>Crear Nuevo Usuario</h3>
          <form onSubmit={crearUsuario} className="form-usuario">
            <div className="form-group">
              <label htmlFor="usuario">
                Nombre de Usuario: *
                <input
                  type="text"
                  id="usuario"
                  name="usuario"
                  value={nuevoUsuario.usuario}
                  onChange={handleChange}
                  placeholder="Ingrese nombre de usuario"
                  required
                />
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Contraseña: *
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={nuevoUsuario.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  minLength="6"
                  required
                />
              </label>
              <small className="form-help">La contraseña debe tener al menos 6 caracteres</small>
            </div>

            <div className="form-group">
              <label htmlFor="rol">
                Rol: *
                <select
                  id="rol"
                  name="rol"
                  value={nuevoUsuario.rol}
                  onChange={handleChange}
                  required
                >
                  <option value="usuario">Usuario</option>
                  <option value="administrador">Administrador</option>
                </select>
              </label>
              <small className="form-help">
                <strong>Usuario:</strong> Puede crear y gestionar sus propios análisis<br />
                <strong>Administrador:</strong> Puede gestionar usuarios y todos los análisis
              </small>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-crear">
                Crear Usuario
              </button>
              <button 
                type="button" 
                onClick={() => setMostrarFormulario(false)}
                className="btn-cancelar"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Información del usuario actual */}
      <div className="info-actual">
        <strong>Usuario actual:</strong> {usuarioActual.usuario} ({usuarioActual.rol})
      </div>

      {/* Tabla de usuarios */}
      <div className="tabla-responsive">
        <table className="tabla-usuarios">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Fecha de Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td className="id-column">{usuario.id}</td>
                <td className="usuario-column">{usuario.usuario}</td>
                <td>
                  <span className={`badge-rol ${usuario.rol}`}>
                    {usuario.rol === 'administrador' ? '🔑 Administrador' : '👤 Usuario'}
                  </span>
                </td>
                <td className="fecha-column">
                  {formatearFecha(usuario.fecha_creacion)}
                </td>
                <td>
                  <div className="acciones-container">
                    {usuario.usuario !== 'FORPW' && (
                      <button
                        onClick={() => eliminarUsuario(usuario.id, usuario.usuario)}
                        className="btn-eliminar"
                        title="Eliminar usuario"
                      >
                        🗑️ Eliminar
                      </button>
                    )}
                    {usuario.usuario === 'FORPW' && (
                      <span className="texto-protegido">🔐 Protegido</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="usuarios-info">
        <p><strong>Total de usuarios:</strong> {usuarios.length}</p>
        <p>
          <strong>Administradores:</strong> {usuarios.filter(u => u.rol === 'administrador').length} | 
          <strong> Usuarios:</strong> {usuarios.filter(u => u.rol === 'usuario').length}
        </p>
      </div>

      <button 
        onClick={cargarUsuarios}
        className="btn-actualizar"
      >
        🔄 Actualizar Lista
      </button>
    </div>
  );
};

export default AdminUsuarios;