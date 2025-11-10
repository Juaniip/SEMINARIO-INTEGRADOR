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

  // Tabla de carpetas (GLOBAL - sin usuario_id)
  db.run(`CREATE TABLE IF NOT EXISTS carpetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabla de análisis
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
      db.run(`ALTER TABLE analisis ADD COLUMN carpeta_id INTEGER`, function(err) {
        if (!err) {
          console.log('✅ Columna carpeta_id agregada exitosamente');
          setTimeout(() => {
            // Crear carpeta General por defecto si no existe
            db.run("INSERT OR IGNORE INTO carpetas (nombre) VALUES ('General')", function(err) {
               if (!err) {
                  db.get(`SELECT id FROM carpetas WHERE nombre = 'General' LIMIT 1`, [], (err, carpeta) => {
                    if (carpeta) {
                      db.run(`UPDATE analisis SET carpeta_id = ? WHERE carpeta_id IS NULL`, [carpeta.id]);
                    }
                  });
               }
            });
          }, 1000);
        }
      });
    }
  });

  // Insertar usuario por defecto
  const hashedPassword = bcrypt.hashSync('UTN2025SEM', 10);
  db.run(`INSERT OR IGNORE INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)`, 
    ['FORPW', hashedPassword, 'administrador'], 
    function(err) {
      if (!err && this.changes > 0) {
        console.log('✅ Usuario administrador principal creado: FORPW');
      }
    }
  );
});

// Middleware para verificar JWT
const verificarToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token de acceso requerido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Función para procesar archivo CSV
function procesarArchivoEnsayo(contenidoCSV, area_usuario, distancia_usuario, constante = 0.949) {
  const lines = contenidoCSV.split('\n');
  let area_archivo = null, maxima_fuerza = null, maximo_desplazamiento = null;
  
  for (let i = 0; i < 23; i++) {
    const line = lines[i];
    if (line.includes('Area;')) area_archivo = parseFloat(line.split(';')[1].replace(',', '.'));
    if (line.includes('Máxima fuerza;')) maxima_fuerza = parseFloat(line.split(';')[1].replace(',', '.'));
    if (line.includes('Máximo Desplazamiento;')) maximo_desplazamiento = parseFloat(line.split(';')[1].replace(',', '.'));
  }

  const area = area_usuario || area_archivo;
  const datos = [];
  for (let i = 23; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const partes = line.split(';');
    if (partes.length >= 4) {
      const desplazamiento = parseFloat(partes[1].replace(',', '.'));
      const fuerza = parseFloat(partes[3].replace(',', '.'));
      if (!isNaN(desplazamiento) && !isNaN(fuerza)) datos.push({ desplazamiento, fuerza });
    }
  }

  let inicio_traccion = 0;
  for (let i = 0; i < datos.length; i++) {
    if (datos[i].fuerza > 0.1) { inicio_traccion = i; break; }
  }

  const desplazamiento_inicial = datos[inicio_traccion].desplazamiento;
  const datos_ajustados = datos.slice(inicio_traccion).map(punto => ({
    desplazamiento: punto.desplazamiento - desplazamiento_inicial,
    fuerza: punto.fuerza
  }));

  const fuerzas = datos_ajustados.map(d => d.fuerza);
  const desplazamientos = datos_ajustados.map(d => d.desplazamiento);
  const fuerza_maxima = Math.max(...fuerzas);
  const tension_maxima = (fuerza_maxima * constante) / area;
  const elongacion_ruptura = Math.max(...desplazamientos);
  
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
  
  const modulo_young = (zona_elastica * suma_xy - suma_x * suma_y) / (zona_elastica * suma_x2 - suma_x * suma_x);

  return {
    tension_maxima: tension_maxima || 0,
    elongacion_ruptura: elongacion_ruptura || 0,
    modulo_young: modulo_young || 0,
    datos_procesados: datos_ajustados,
    metadatos: { area_archivo, maxima_fuerza, maximo_desplazamiento, puntos_totales: datos.length, inicio_traccion }
  };
}

// Rutas de autenticación
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Datos incompletos' });

  db.get('SELECT * FROM usuarios WHERE usuario = ?', [usuario], (err, row) => {
    if (err || !row) return res.status(401).json({ error: 'Credenciales inválidas' });
    bcrypt.compare(password, row.password, (err, isMatch) => {
      if (err || !isMatch) return res.status(401).json({ error: 'Credenciales inválidas' });
      const token = jwt.sign({ id: row.id, usuario: row.usuario, rol: row.rol }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ message: 'Login exitoso', token, usuario: { id: row.id, usuario: row.usuario, rol: row.rol } });
    });
  });
});

app.get('/api/verify-token', verificarToken, (req, res) => {
  res.json({ valid: true, usuario: req.usuario });
});

// === RUTAS CORREGIDAS PARA ACCESO GLOBAL ===

// Obtener TODAS las carpetas (Global)
app.get('/api/carpetas', verificarToken, (req, res) => {
  // CORRECCIÓN: Eliminado 'WHERE c.usuario_id = ?'
  db.all(`
    SELECT c.*, COUNT(a.id) as total_analisis
    FROM carpetas c
    LEFT JOIN analisis a ON c.id = a.carpeta_id
    GROUP BY c.id
    ORDER BY c.nombre ASC
  `, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener carpetas:', err.message);
      return res.status(500).json({ error: 'Error al obtener carpetas' });
    }
    res.json(rows);
  });
});

// Crear nueva carpeta (Global)
app.post('/api/carpetas', verificarToken, (req, res) => {
  const { nombre } = req.body;
  if (!nombre || nombre.trim().length === 0) return res.status(400).json({ error: 'Nombre requerido' });
  const nombreLimpio = nombre.trim();

  // CORRECCIÓN: Eliminado 'AND usuario_id = ?'
  db.get('SELECT id FROM carpetas WHERE nombre = ?', [nombreLimpio], (err, row) => {
    if (row) return res.status(400).json({ error: 'Ya existe una carpeta con ese nombre' });

    // CORRECCIÓN: Eliminado 'usuario_id' del INSERT
    db.run('INSERT INTO carpetas (nombre) VALUES (?)', [nombreLimpio], function(err) {
      if (err) return res.status(500).json({ error: 'Error al crear carpeta' });
      res.json({ message: 'Carpeta global creada', id: this.lastID, nombre: nombreLimpio });
    });
  });
});

// Eliminar carpeta (Global - cualquiera puede si está vacía)
app.delete('/api/carpetas/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  // CORRECCIÓN: Eliminado check de usuario_id
  db.get('SELECT * FROM carpetas WHERE id = ?', [id], (err, carpeta) => {
    if (!carpeta) return res.status(404).json({ error: 'Carpeta no encontrada' });

    db.get('SELECT COUNT(*) as count FROM analisis WHERE carpeta_id = ?', [id], (err, result) => {
      if (result.count > 0) return res.status(400).json({ error: `Carpeta no vacía (${result.count} análisis).` });
      db.run('DELETE FROM carpetas WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: 'Error al eliminar' });
        res.json({ message: 'Carpeta eliminada' });
      });
    });
  });
});

// Obtener análisis de una carpeta (Global)
app.get('/api/carpetas/:id/analisis', verificarToken, (req, res) => {
  // CORRECCIÓN: Eliminado 'AND c.usuario_id = ?'
  db.all(`
    SELECT a.*, u.usuario as nombre_usuario, c.nombre as nombre_carpeta
    FROM analisis a 
    JOIN usuarios u ON a.usuario_id = u.id 
    JOIN carpetas c ON a.carpeta_id = c.id
    WHERE a.carpeta_id = ?
    ORDER BY a.fecha_analisis DESC
  `, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener análisis' });
    res.json(rows);
  });
});

// Datos relevantes globales
app.get('/api/datos-relevantes', verificarToken, (req, res) => {
  // CORRECCIÓN: Eliminado 'WHERE c.usuario_id = ?'
  db.all(`
    SELECT 
      c.id as carpeta_id, c.nombre as carpeta_nombre,
      COUNT(a.id) as total_analisis,
      AVG(a.tension_maxima) as avg_tension, AVG(a.elongacion_ruptura) as avg_elongacion, AVG(a.modulo_young) as avg_modulo,
      MAX(a.tension_maxima) as max_tension, MAX(a.elongacion_ruptura) as max_elongacion, MAX(a.modulo_young) as max_modulo,
      MIN(a.tension_maxima) as min_tension, MIN(a.elongacion_ruptura) as min_elongacion, MIN(a.modulo_young) as min_modulo
    FROM carpetas c
    LEFT JOIN analisis a ON c.id = a.carpeta_id
    GROUP BY c.id, c.nombre
    ORDER BY c.nombre ASC
  `, [], (err, rows) => res.json(err ? [] : rows));
});

app.get('/api/datos-relevantes/:carpeta_id', verificarToken, (req, res) => {
  // CORRECCIÓN: Eliminado 'AND c.usuario_id = ?'
  db.all(`
    SELECT a.id, a.fecha_analisis, a.tension_maxima, a.elongacion_ruptura, a.modulo_young,
           u.usuario as nombre_usuario, c.nombre as carpeta_nombre
    FROM analisis a 
    JOIN usuarios u ON a.usuario_id = u.id 
    JOIN carpetas c ON a.carpeta_id = c.id
    WHERE a.carpeta_id = ?
    ORDER BY a.fecha_analisis DESC
  `, [req.params.carpeta_id], (err, rows) => res.json(err ? [] : rows));
});

// Rutas de Análisis (POST, DELETE, GET individual) - MANTENIDAS IGUAL
app.post('/api/analisis', verificarToken, (req, res) => {
  const { area, distancia, constante, archivo_nombre, archivo_datos, carpeta_id } = req.body;
  if (!distancia || !archivo_datos || !carpeta_id) return res.status(400).json({ error: 'Faltan datos' });
  if (archivo_datos.startsWith('[') || archivo_datos.startsWith('{')) return res.status(400).json({ error: 'Archivo inválido (JSON)' });

  try {
    const resultados = procesarArchivoEnsayo(archivo_datos, area ? parseFloat(area) : null, parseFloat(distancia), parseFloat(constante) || 0.949);
    const area_final = area ? parseFloat(area) : resultados.metadatos.area_archivo;
    if (!area_final) return res.status(400).json({ error: 'Área no encontrada' });

    db.run(`INSERT INTO analisis (usuario_id, carpeta_id, area, distancia, constante, archivo_nombre, archivo_datos, datos_procesados, tension_maxima, elongacion_ruptura, modulo_young) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [req.usuario.id, carpeta_id, area_final, distancia, constante || 0.949, archivo_nombre, archivo_datos, JSON.stringify(resultados.datos_procesados), resultados.tension_maxima, resultados.elongacion_ruptura, resultados.modulo_young], 
      function(err) {
        if (err) return res.status(500).json({ error: 'Error al guardar' });
        res.json({ message: 'Análisis guardado', id: this.lastID, resultados: { ...resultados, datos_procesados: undefined } });
      });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/analisis/:id', verificarToken, (req, res) => {
  // Solo el dueño o admin puede borrar análisis
  db.get('SELECT usuario_id FROM analisis WHERE id = ?', [req.params.id], (err, row) => {
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    if (row.usuario_id !== req.usuario.id && req.usuario.rol !== 'administrador') return res.status(403).json({ error: 'Sin permiso' });
    db.run('DELETE FROM analisis WHERE id = ?', [req.params.id], (err) => res.json({ message: 'Eliminado' }));
  });
});

app.get('/api/analisis/:id/descargar-csv', verificarToken, (req, res) => {
  db.get('SELECT archivo_nombre, archivo_datos FROM analisis WHERE id = ?', [req.params.id], (err, row) => {
    if (!row || !row.archivo_datos) return res.status(404).json({ error: 'No disponible' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${row.archivo_nombre || 'analisis.csv'}"`);
    res.send(row.archivo_datos);
  });
});

app.get('/api/analisis/:id', verificarToken, (req, res) => {
  db.get(`SELECT a.*, u.usuario as nombre_usuario FROM analisis a JOIN usuarios u ON a.usuario_id = u.id WHERE a.id = ?`, [req.params.id], (err, row) => {
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    let datosGrafica = [];
    if (row.datos_procesados) { try { datosGrafica = JSON.parse(row.datos_procesados).map(p => ({ desplazamiento: p.desplazamiento, fuerza: p.fuerza, tension: (p.fuerza * row.constante) / row.area, deformacion: p.desplazamiento / row.distancia })); } catch (e) {} }
    res.json({ ...row, datos_grafica: datosGrafica });
  });
});

app.get('/api/analisis', verificarToken, (req, res) => {
  db.all(`SELECT a.*, u.usuario as nombre_usuario FROM analisis a JOIN usuarios u ON a.usuario_id = u.id ORDER BY a.fecha_analisis DESC`, [], (err, rows) => res.json(err ? [] : rows));
});

// Gestión de Usuarios (Solo Admin) - SIN CAMBIOS
app.get('/api/usuarios', verificarToken, (req, res) => {
  if (req.usuario.rol !== 'administrador') return res.status(403).json({ error: 'Requiere admin' });
  db.all('SELECT id, usuario, rol, fecha_creacion FROM usuarios ORDER BY fecha_creacion DESC', [], (err, rows) => res.json(err ? [] : rows));
});

app.post('/api/usuarios', verificarToken, async (req, res) => {
  if (req.usuario.rol !== 'administrador') return res.status(403).json({ error: 'Requiere admin' });
  const { usuario, password, rol } = req.body;
  try {
    const hp = await bcrypt.hash(password, 10);
    db.run('INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)', [usuario, hp, rol], function(err) {
      if (err) return res.status(400).json({ error: 'Usuario ya existe' });
      res.json({ message: 'Creado', id: this.lastID });
    });
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

app.delete('/api/usuarios/:id', verificarToken, (req, res) => {
  if (req.usuario.rol !== 'administrador') return res.status(403).json({ error: 'Requiere admin' });
  db.get('SELECT usuario FROM usuarios WHERE id = ?', [req.params.id], (err, u) => {
    if (!u) return res.status(404).json({ error: 'No encontrado' });
    if (u.usuario === 'FORPW') return res.status(403).json({ error: 'No se puede eliminar al admin principal' });
    db.get('SELECT COUNT(*) as c FROM analisis WHERE usuario_id = ?', [req.params.id], (err, r) => {
      if (r.c > 0) return res.status(400).json({ error: 'Usuario tiene análisis asociados' });
      db.run('DELETE FROM usuarios WHERE id = ?', [req.params.id], () => res.json({ message: 'Eliminado' }));
    });
  });
});

process.on('SIGINT', () => { db.close(); process.exit(0); });
app.listen(PORT, () => console.log(`Servidor GLOBAL ejecutándose en puerto ${PORT}`));

module.exports = app;