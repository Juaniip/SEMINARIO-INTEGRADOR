const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'tu_jwt_secret_key_muy_segura_aqui';

// Middleware con límites aumentados
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Configuración de multer para archivos grandes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// Crear/conectar a la base de datos
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite.');
  }
});

// Crear tablas si no existen
db.serialize(() => {
  // Tabla de usuarios
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT DEFAULT 'usuario',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabla de carpetas
  db.run(`CREATE TABLE IF NOT EXISTS carpetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    usuario_id INTEGER,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
  )`);

  // Tabla de análisis (actualizada con carpeta_id)
  db.run(`CREATE TABLE IF NOT EXISTS analisis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    carpeta_id INTEGER,
    area REAL NOT NULL,
    distancia REAL NOT NULL,
    constante REAL DEFAULT 0.949,
    archivo_nombre TEXT,
    archivo_datos TEXT,
    datos_procesados TEXT,
    tension_maxima REAL,
    elongacion_ruptura REAL,
    modulo_young REAL,
    fecha_analisis DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY(carpeta_id) REFERENCES carpetas(id)
  )`);

  // MIGRACIÓN: Verificar y agregar carpeta_id si no existe
  db.all(`PRAGMA table_info(analisis)`, [], (err, columns) => {
    if (err) {
      console.error('Error al obtener info de tabla analisis:', err);
      return;
    }
    
    const tieneCarpetaId = columns.some(col => col.name === 'carpeta_id');
    
    if (!tieneCarpetaId) {
      console.log('Agregando columna carpeta_id a tabla analisis...');
      
      // Agregar la columna
      db.run(`ALTER TABLE analisis ADD COLUMN carpeta_id INTEGER`, function(err) {
        if (err) {
          console.error('Error al agregar columna carpeta_id:', err);
        } else {
          console.log('✅ Columna carpeta_id agregada exitosamente');
          
          // Obtener la carpeta "General" para asignar análisis existentes
          setTimeout(() => {
            db.get(`SELECT id FROM carpetas WHERE nombre = 'General' LIMIT 1`, [], (err, carpetaGeneral) => {
              if (err) {
                console.error('Error al buscar carpeta General:', err);
                return;
              }
              
              if (carpetaGeneral) {
                // Asignar todos los análisis existentes a la carpeta General
                db.run(`UPDATE analisis SET carpeta_id = ? WHERE carpeta_id IS NULL`, [carpetaGeneral.id], function(err) {
                  if (err) {
                    console.error('Error al actualizar análisis existentes:', err);
                  } else if (this.changes > 0) {
                    console.log(`✅ ${this.changes} análisis asignados a carpeta General`);
                  }
                });
              }
            });
          }, 1000); // Esperar a que se cree el usuario y carpeta
        }
      });
    } else {
      console.log('✅ Columna carpeta_id ya existe');
    }
  });

  // Insertar usuario por defecto si no existe
  const hashedPassword = bcrypt.hashSync('UTN2025SEM', 10);
  db.run(`INSERT OR IGNORE INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)`, 
    ['investigador', hashedPassword, 'administrador'], 
    function(err) {
      if (err) {
        console.error('Error al crear usuario por defecto:', err.message);
      } else if (this.changes > 0) {
        console.log('Usuario por defecto creado: investigador');
        
        // Crear carpeta por defecto "General"
        db.run(`INSERT OR IGNORE INTO carpetas (nombre, usuario_id) VALUES (?, ?)`,
          ['General', this.lastID],
          function(err) {
            if (err) {
              console.error('Error al crear carpeta por defecto:', err.message);
            } else if (this.changes > 0) {
              console.log('Carpeta por defecto creada: General');
            }
          }
        );
      }
    }
  );
});

// Middleware para verificar JWT
const verificarToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Función para procesar archivo CSV de la máquina de ensayos
function procesarArchivoEnsayo(contenidoCSV, area_usuario, distancia_usuario, constante = 0.949) {
  const lines = contenidoCSV.split('\n');
  
  // Extraer metadatos
  let area_archivo = null;
  let maxima_fuerza = null;
  let maximo_desplazamiento = null;
  
  for (let i = 0; i < 23; i++) {
    const line = lines[i];
    if (line.includes('Area;')) {
      area_archivo = parseFloat(line.split(';')[1].replace(',', '.'));
    }
    if (line.includes('Máxima fuerza;')) {
      maxima_fuerza = parseFloat(line.split(';')[1].replace(',', '.'));
    }
    if (line.includes('Máximo Desplazamiento;')) {
      maximo_desplazamiento = parseFloat(line.split(';')[1].replace(',', '.'));
    }
  }

  // Usar área del usuario o del archivo
  const area = area_usuario || area_archivo;
  
  // Procesar datos (empezar desde línea 24)
  const datos = [];
  for (let i = 23; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const partes = line.split(';');
    if (partes.length >= 4) {
      const desplazamiento = parseFloat(partes[1].replace(',', '.'));
      const fuerza = parseFloat(partes[3].replace(',', '.'));
      
      if (!isNaN(desplazamiento) && !isNaN(fuerza)) {
        datos.push({ desplazamiento, fuerza });
      }
    }
  }

  // Encontrar donde empieza la tracción real (fuerza > 0.1 N)
  let inicio_traccion = 0;
  for (let i = 0; i < datos.length; i++) {
    if (datos[i].fuerza > 0.1) {
      inicio_traccion = i;
      break;
    }
  }

  // Ajustar datos al origen (desplazamiento inicial = 0)
  const desplazamiento_inicial = datos[inicio_traccion].desplazamiento;
  const datos_ajustados = datos.slice(inicio_traccion).map(punto => ({
    desplazamiento: punto.desplazamiento - desplazamiento_inicial,
    fuerza: punto.fuerza
  }));

  // Calcular parámetros mecánicos
  const fuerzas = datos_ajustados.map(d => d.fuerza);
  const desplazamientos = datos_ajustados.map(d => d.desplazamiento);
  
  // Tensión máxima = Fuerza máxima / Área
  const fuerza_maxima = Math.max(...fuerzas);
  const tension_maxima = (fuerza_maxima * constante) / area;
  
  // Elongación de ruptura = Desplazamiento máximo
  const elongacion_ruptura = Math.max(...desplazamientos);
  
  // Módulo de Young = pendiente en zona elástica (primeros 20% de datos)
  const zona_elastica = Math.floor(datos_ajustados.length * 0.2);
  let suma_x = 0, suma_y = 0, suma_xy = 0, suma_x2 = 0;
  
  for (let i = 0; i < zona_elastica; i++) {
    const deformacion = datos_ajustados[i].desplazamiento / distancia_usuario;
    const tension = (datos_ajustados[i].fuerza * constante) / area;
    
    suma_x += deformacion;
    suma_y += tension;
    suma_xy += deformacion * tension;
    suma_x2 += deformacion * deformacion;
  }
  
  const modulo_young = (zona_elastica * suma_xy - suma_x * suma_y) / 
                      (zona_elastica * suma_x2 - suma_x * suma_x);

  return {
    tension_maxima: tension_maxima || 0,
    elongacion_ruptura: elongacion_ruptura || 0,
    modulo_young: modulo_young || 0,
    datos_procesados: datos_ajustados,
    metadatos: {
      area_archivo,
      maxima_fuerza,
      maximo_desplazamiento,
      puntos_totales: datos.length,
      inicio_traccion
    }
  };
}

// Rutas de autenticación
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  db.get('SELECT * FROM usuarios WHERE usuario = ?', [usuario], (err, row) => {
    if (err) {
      console.error('Error en la consulta:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (!row) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    bcrypt.compare(password, row.password, (err, isMatch) => {
      if (err) {
        console.error('Error al verificar contraseña:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      if (!isMatch) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Generar JWT
      const token = jwt.sign(
        { 
          id: row.id, 
          usuario: row.usuario, 
          rol: row.rol 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login exitoso',
        token,
        usuario: {
          id: row.id,
          usuario: row.usuario,
          rol: row.rol
        }
      });
    });
  });
});

// Ruta para verificar token
app.get('/api/verify-token', verificarToken, (req, res) => {
  res.json({ 
    valid: true, 
    usuario: req.usuario 
  });
});

// Rutas para análisis - CON DEBUGGING INCLUIDO Y CARPETA_ID
app.post('/api/analisis', verificarToken, (req, res) => {
  const { area, distancia, constante, archivo_nombre, archivo_datos, carpeta_id } = req.body;
  
  // DEBUGGING: Verificar qué datos recibimos
  console.log('=== DEBUGGING ANÁLISIS ===');
  console.log('Archivo nombre:', archivo_nombre);
  console.log('Carpeta ID:', carpeta_id);
  console.log('Tipo de archivo_datos:', typeof archivo_datos);
  console.log('Primeros 200 caracteres recibidos:', archivo_datos.substring(0, 200));
  console.log('¿Es JSON?', archivo_datos.startsWith('[') || archivo_datos.startsWith('{'));
  console.log('========================');
  
  if (!distancia) {
    return res.status(400).json({ error: 'Distancia entre mordazas es requerida' });
  }

  if (!archivo_datos) {
    return res.status(400).json({ error: 'Archivo CSV es requerido' });
  }

  if (!carpeta_id) {
    return res.status(400).json({ error: 'Carpeta es requerida' });
  }

  // Verificar que recibimos CSV, no JSON
  if (archivo_datos.startsWith('[') || archivo_datos.startsWith('{')) {
    console.error('ERROR: Recibimos JSON del frontend en lugar de CSV');
    return res.status(400).json({ 
      error: 'Error: se recibió JSON en lugar del archivo CSV original. Verifica el frontend.' 
    });
  }

  try {
    // Procesar el archivo CSV de la máquina de ensayos
    const resultados = procesarArchivoEnsayo(
      archivo_datos, 
      area ? parseFloat(area) : null, 
      parseFloat(distancia), 
      parseFloat(constante) || 0.949
    );

    // Usar área del archivo si no se proporcionó área del usuario
    const area_final = area ? parseFloat(area) : resultados.metadatos.area_archivo;

    if (!area_final) {
      return res.status(400).json({ 
        error: 'Área requerida: no se encontró en el archivo ni fue proporcionada por el usuario' 
      });
    }

    console.log('=== GUARDANDO EN BD ===');
    console.log('Guardando archivo original (primeros 100 chars):', archivo_datos.substring(0, 100));
    console.log('Guardando datos procesados (cantidad de puntos):', resultados.datos_procesados.length);
    console.log('Guardando en carpeta ID:', carpeta_id);

    // Guardar en base de datos
    // CRÍTICO: archivo_datos = CSV ORIGINAL, datos_procesados = JSON para gráficas
    db.run(`INSERT INTO analisis (
      usuario_id, carpeta_id, area, distancia, constante, archivo_nombre, archivo_datos, datos_procesados,
      tension_maxima, elongacion_ruptura, modulo_young
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [
      req.usuario.id, 
      carpeta_id,
      area_final, 
      distancia, 
      constante || 0.949, 
      archivo_nombre, 
      archivo_datos, // ← ARCHIVO CSV ORIGINAL COMPLETO
      JSON.stringify(resultados.datos_procesados), // ← DATOS PROCESADOS PARA GRÁFICAS
      resultados.tension_maxima, 
      resultados.elongacion_ruptura, 
      resultados.modulo_young
    ], 
    function(err) {
      if (err) {
        console.error('Error al guardar análisis:', err.message);
        return res.status(500).json({ error: 'Error al guardar análisis' });
      }

      console.log('✅ Análisis guardado con ID:', this.lastID);

      res.json({
        message: 'Análisis procesado y guardado exitosamente',
        id: this.lastID,
        resultados: {
          tension_maxima: resultados.tension_maxima,
          elongacion_ruptura: resultados.elongacion_ruptura,
          modulo_young: resultados.modulo_young
        },
        metadatos: resultados.metadatos,
        datos_procesados: resultados.datos_procesados
      });
    });

  } catch (error) {
    console.error('Error al procesar archivo:', error);
    res.status(500).json({ 
      error: 'Error al procesar el archivo CSV: ' + error.message 
    });
  }
});

// NUEVOS ENDPOINTS PARA CARPETAS

// Obtener todas las carpetas del usuario
app.get('/api/carpetas', verificarToken, (req, res) => {
  console.log('=== DEBUG CARPETAS ===');
  console.log('Usuario ID:', req.usuario.id);
  
  db.all(`
    SELECT c.*, COUNT(a.id) as total_analisis
    FROM carpetas c
    LEFT JOIN analisis a ON c.id = a.carpeta_id
    WHERE c.usuario_id = ?
    GROUP BY c.id
    ORDER BY c.nombre ASC
  `, [req.usuario.id], (err, rows) => {
    if (err) {
      console.error('Error al obtener carpetas:', err.message);
      return res.status(500).json({ error: 'Error al obtener carpetas: ' + err.message });
    }

    console.log('Carpetas encontradas:', rows);
    res.json(rows);
  });
});

// Crear nueva carpeta
app.post('/api/carpetas', verificarToken, (req, res) => {
  const { nombre } = req.body;

  if (!nombre || nombre.trim().length === 0) {
    return res.status(400).json({ error: 'El nombre de la carpeta es requerido' });
  }

  const nombreLimpio = nombre.trim();

  // Verificar que no existe una carpeta con el mismo nombre para este usuario
  db.get('SELECT id FROM carpetas WHERE nombre = ? AND usuario_id = ?', [nombreLimpio, req.usuario.id], (err, row) => {
    if (err) {
      console.error('Error al verificar carpeta:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (row) {
      return res.status(400).json({ error: 'Ya existe una carpeta con ese nombre' });
    }

    // Crear la carpeta
    db.run('INSERT INTO carpetas (nombre, usuario_id) VALUES (?, ?)', [nombreLimpio, req.usuario.id], function(err) {
      if (err) {
        console.error('Error al crear carpeta:', err.message);
        return res.status(500).json({ error: 'Error al crear carpeta' });
      }

      console.log('Carpeta creada con ID:', this.lastID);
      res.json({
        message: 'Carpeta creada exitosamente',
        id: this.lastID,
        nombre: nombreLimpio
      });
    });
  });
});

// Eliminar carpeta (solo si está vacía)
app.delete('/api/carpetas/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;

  // Verificar que la carpeta existe y pertenece al usuario
  db.get('SELECT * FROM carpetas WHERE id = ? AND usuario_id = ?', [id, usuarioId], (err, carpeta) => {
    if (err) {
      console.error('Error al verificar carpeta:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (!carpeta) {
      return res.status(404).json({ error: 'Carpeta no encontrada' });
    }

    // No permitir eliminar la carpeta "General"
    if (carpeta.nombre === 'General') {
      return res.status(400).json({ error: 'No se puede eliminar la carpeta General' });
    }

    // Verificar que no tenga análisis
    db.get('SELECT COUNT(*) as count FROM analisis WHERE carpeta_id = ?', [id], (err, result) => {
      if (err) {
        console.error('Error al contar análisis:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      if (result.count > 0) {
        return res.status(400).json({ 
          error: `No se puede eliminar la carpeta porque contiene ${result.count} análisis. Mueve o elimina los análisis primero.` 
        });
      }

      // Eliminar la carpeta
      db.run('DELETE FROM carpetas WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error al eliminar carpeta:', err.message);
          return res.status(500).json({ error: 'Error al eliminar carpeta' });
        }

        console.log('Carpeta eliminada ID:', id);
        res.json({ message: 'Carpeta eliminada exitosamente' });
      });
    });
  });
});

// Obtener análisis de una carpeta específica
app.get('/api/carpetas/:id/analisis', verificarToken, (req, res) => {
  const { id } = req.params;

  db.all(`
    SELECT a.*, u.usuario as nombre_usuario, c.nombre as nombre_carpeta
    FROM analisis a 
    JOIN usuarios u ON a.usuario_id = u.id 
    JOIN carpetas c ON a.carpeta_id = c.id
    WHERE a.carpeta_id = ? AND c.usuario_id = ?
    ORDER BY a.fecha_analisis DESC
  `, [id, req.usuario.id], (err, rows) => {
    if (err) {
      console.error('Error al obtener análisis de carpeta:', err.message);
      return res.status(500).json({ error: 'Error al obtener análisis de carpeta' });
    }

    res.json(rows);
  });
});

// Descargar archivo CSV original (crudo) - CORREGIDO
app.get('/api/analisis/:id/descargar-csv', verificarToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT archivo_nombre, archivo_datos FROM analisis WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error al obtener archivo:', err.message);
      return res.status(500).json({ error: 'Error al obtener archivo' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Análisis no encontrado' });
    }

    if (!row.archivo_datos) {
      return res.status(404).json({ error: 'Archivo no disponible' });
    }

    console.log('=== DESCARGA CSV ===');
    console.log('Descargando archivo:', row.archivo_nombre);
    console.log('Primeros 200 caracteres del archivo:', row.archivo_datos.substring(0, 200));

    // Verificar si el contenido es JSON (datos corruptos)
    if (row.archivo_datos.startsWith('[') || row.archivo_datos.startsWith('{')) {
      console.log('Detectado contenido JSON, no es el archivo original');
      return res.status(400).json({ 
        error: 'El archivo original no está disponible. Este análisis fue creado con una versión anterior. Por favor, realice un nuevo análisis.' 
      });
    }

    // Configurar headers para descarga del archivo CSV original
    const nombreArchivo = row.archivo_nombre || `analisis_original_${id}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Content-Length', Buffer.byteLength(row.archivo_datos, 'utf8'));
    
    console.log('✅ Enviando archivo CSV original');
    
    // Enviar el contenido del archivo original sin modificaciones
    res.send(row.archivo_datos);
  });
});

// Obtener datos de un análisis específico para la página de reporte
app.get('/api/analisis/:id', verificarToken, (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT a.*, u.usuario as nombre_usuario 
    FROM analisis a 
    JOIN usuarios u ON a.usuario_id = u.id 
    WHERE a.id = ?
  `, [id], (err, row) => {
    if (err) {
      console.error('Error al obtener análisis:', err.message);
      return res.status(500).json({ error: 'Error al obtener análisis' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Análisis no encontrado' });
    }

    // Procesar datos para gráficas si existen
    let datosGrafica = [];
    if (row.datos_procesados) {
      try {
        const datos = JSON.parse(row.datos_procesados);
        datosGrafica = datos.map(punto => ({
          desplazamiento: punto.desplazamiento,
          fuerza: punto.fuerza,
          tension: (punto.fuerza * row.constante) / row.area,
          deformacion: punto.desplazamiento / row.distancia
        }));
      } catch (error) {
        console.error('Error al procesar datos:', error);
      }
    }

    res.json({
      ...row,
      datos_grafica: datosGrafica
    });
  });
});

// Eliminar un análisis
app.delete('/api/analisis/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;
  const usuarioRol = req.usuario.rol;

  // Verificar que el análisis existe y pertenece al usuario (o es administrador)
  db.get('SELECT usuario_id FROM analisis WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error al verificar análisis:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Análisis no encontrado' });
    }

    // Solo el dueño del análisis o un administrador puede eliminarlo
    if (row.usuario_id !== usuarioId && usuarioRol !== 'administrador') {
      return res.status(403).json({ error: 'No tienes permisos para eliminar este análisis' });
    }

    // Eliminar el análisis
    db.run('DELETE FROM analisis WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Error al eliminar análisis:', err.message);
        return res.status(500).json({ error: 'Error al eliminar análisis' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Análisis no encontrado' });
      }

      console.log('Análisis eliminado ID:', id);
      res.json({ message: 'Análisis eliminado exitosamente' });
    });
  });
});

// Obtener historial de análisis
app.get('/api/analisis', verificarToken, (req, res) => {
  db.all(`
    SELECT a.*, u.usuario as nombre_usuario 
    FROM analisis a 
    JOIN usuarios u ON a.usuario_id = u.id 
    ORDER BY a.fecha_analisis DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener análisis:', err.message);
      return res.status(500).json({ error: 'Error al obtener análisis' });
    }

    res.json(rows);
  });
});

// Obtener datos relevantes por carpetas
app.get('/api/datos-relevantes', verificarToken, (req, res) => {
  // Obtener estadísticas por carpeta
  db.all(`
    SELECT 
      c.id as carpeta_id,
      c.nombre as carpeta_nombre,
      COUNT(a.id) as total_analisis,
      AVG(a.tension_maxima) as avg_tension,
      AVG(a.elongacion_ruptura) as avg_elongacion,
      AVG(a.modulo_young) as avg_modulo,
      MAX(a.tension_maxima) as max_tension,
      MAX(a.elongacion_ruptura) as max_elongacion,
      MAX(a.modulo_young) as max_modulo,
      MIN(a.tension_maxima) as min_tension,
      MIN(a.elongacion_ruptura) as min_elongacion,
      MIN(a.modulo_young) as min_modulo
    FROM carpetas c
    LEFT JOIN analisis a ON c.id = a.carpeta_id
    WHERE c.usuario_id = ?
    GROUP BY c.id, c.nombre
    ORDER BY c.nombre ASC
  `, [req.usuario.id], (err, carpetas) => {
    if (err) {
      console.error('Error al obtener datos relevantes por carpetas:', err.message);
      return res.status(500).json({ error: 'Error al obtener datos relevantes: ' + err.message });
    }

    res.json(carpetas);
  });
});

// Obtener análisis individuales de una carpeta
app.get('/api/datos-relevantes/:carpeta_id', verificarToken, (req, res) => {
  const { carpeta_id } = req.params;

  db.all(`
    SELECT 
      a.id,
      a.fecha_analisis,
      a.tension_maxima,
      a.elongacion_ruptura,
      a.modulo_young,
      u.usuario as nombre_usuario,
      c.nombre as carpeta_nombre
    FROM analisis a 
    JOIN usuarios u ON a.usuario_id = u.id 
    JOIN carpetas c ON a.carpeta_id = c.id
    WHERE a.carpeta_id = ? AND c.usuario_id = ?
    ORDER BY a.fecha_analisis DESC
  `, [carpeta_id, req.usuario.id], (err, rows) => {
    if (err) {
      console.error('Error al obtener análisis de carpeta:', err.message);
      return res.status(500).json({ error: 'Error al obtener análisis de carpeta' });
    }

    res.json(rows);
  });
});

// Generar PDF del historial de datos relevantes
app.get('/api/datos-relevantes/pdf', verificarToken, (req, res) => {
  db.all(`
    SELECT 
      a.id,
      a.fecha_analisis,
      a.tension_maxima,
      a.elongacion_ruptura,
      a.modulo_young,
      u.usuario as nombre_usuario
    FROM analisis a 
    JOIN usuarios u ON a.usuario_id = u.id 
    ORDER BY a.fecha_analisis DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener datos para PDF:', err.message);
      return res.status(500).json({ error: 'Error al obtener datos para PDF' });
    }

    // Generar contenido HTML para PDF
    const fechaActual = new Date().toLocaleDateString('es-AR');
    const horaActual = new Date().toLocaleTimeString('es-AR');

    let tablasHTML = '';
    if (rows.length === 0) {
      tablasHTML = '<p style="text-align: center; color: #666;">No hay datos disponibles</p>';
    } else {
      tablasHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">ID Análisis</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Fecha</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Usuario</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Tensión Máxima (MPa)</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Elongación Ruptura (mm)</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Módulo Young (MPa)</th>
            </tr>
          </thead>
          <tbody>`;
      
      rows.forEach((row, index) => {
        const fecha = new Date(row.fecha_analisis).toLocaleDateString('es-AR');
        const bgColor = index % 2 === 0 ? '#fafbfc' : 'white';
        
        tablasHTML += `
          <tr style="background-color: ${bgColor};">
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold; color: #007bff;">${row.id}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 12px;">${fecha}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${row.nombre_usuario}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-family: monospace;">${row.tension_maxima ? row.tension_maxima.toFixed(3) : 'N/A'}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-family: monospace;">${row.elongacion_ruptura ? row.elongacion_ruptura.toFixed(3) : 'N/A'}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-family: monospace;">${row.modulo_young ? row.modulo_young.toFixed(3) : 'N/A'}</td>
          </tr>`;
      });
      
      tablasHTML += '</tbody></table>';
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Historial de Datos Relevantes</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.4;
        }
        .header { 
            text-align: center; 
            border-bottom: 3px solid #007bff; 
            padding-bottom: 20px; 
            margin-bottom: 30px;
        }
        .header h1 { 
            color: #333; 
            margin: 0 0 10px 0; 
        }
        .info { 
            color: #666; 
            font-size: 14px; 
        }
        @media print {
            body { print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Historial de Datos Relevantes</h1>
        <h2>Análisis de Propiedades Mecánicas</h2>
        <div class="info">
            <p><strong>Fecha de generación:</strong> ${fechaActual} - ${horaActual}</p>
            <p><strong>Total de análisis:</strong> ${rows.length}</p>
        </div>
    </div>
    
    ${tablasHTML}
    
    <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
        <p>Sistema de Análisis de Propiedades Mecánicas - Universidad Tecnológica Nacional</p>
        <p>Generado automáticamente el ${fechaActual} a las ${horaActual}</p>
    </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="datos_relevantes_${fechaActual.replace(/\//g, '-')}.html"`);
    res.send(htmlContent);
  });
});

// Cerrar conexión de base de datos al terminar la aplicación
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error al cerrar la base de datos:', err.message);
    } else {
      console.log('Conexión a la base de datos cerrada.');
    }
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});

module.exports = app;