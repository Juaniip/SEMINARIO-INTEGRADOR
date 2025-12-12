const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.ENV_PORT || 5000;
const JWT_SECRET = 'tu_jwt_secret_key_muy_segura_aqui';

// --- MIDDLEWARE ---
app.use(cors());
// Aumentamos el límite para permitir archivos CSV grandes
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Configuración de Multer (Carga de archivos en memoria)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// --- BASE DE DATOS ---
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error('Error al conectar DB:', err.message);
  else console.log('Conectado a la base de datos SQLite.');
});

// Inicialización de Tablas
db.serialize(() => {
  // 1. Usuarios
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT DEFAULT 'usuario',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. Carpetas
  db.run(`CREATE TABLE IF NOT EXISTS carpetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 3. Análisis
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

  // Crear Usuario Admin por defecto (Si no existe)
  const pass = bcrypt.hashSync('UTN2025SEM', 10);
  db.run(`INSERT OR IGNORE INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)`, 
    ['FORPW', pass, 'administrador']
  );
});

// --- SEGURIDAD (JWT) ---
const verificarToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token de acceso requerido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// --- LÓGICA CIENTÍFICA (Procesamiento de Materiales) ---

// Función auxiliar para calcular pendiente (m) y R2
function regresionLineal(puntos) {
  let n = puntos.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let p of puntos) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }
  
  const denominador = (n * sumX2 - sumX * sumX);
  if (denominador === 0) return { m: 0, r2: 0, b: 0 };

  const m = (n * sumXY - sumX * sumY) / denominador;
  
  // Cálculo de intersección (b) y R2
  const mediaY = sumY / n;
  const b = (sumY - m * sumX) / n;
  const ss_res = puntos.reduce((acc, p) => acc + Math.pow(p.y - (m * p.x + b), 2), 0);
  const ss_tot = puntos.reduce((acc, p) => acc + Math.pow(p.y - mediaY, 2), 0);
  const r2 = ss_tot === 0 ? 0 : 1 - (ss_res / ss_tot);

  return { m, r2, b };
}

function procesarArchivoEnsayo(contenidoCSV, area_usuario, distancia_usuario, constante = 0.949) {
  const lines = contenidoCSV.split('\n');
  let area_archivo = null;

  // 1. Leer metadatos del encabezado
  for (let i = 0; i < 23; i++) {
    const line = lines[i];
    if (line && line.includes('Area;')) {
        const parts = line.split(';');
        if(parts[1]) area_archivo = parseFloat(parts[1].replace(',', '.'));
    }
  }
  const area = area_usuario || area_archivo;
  
  // 2. Extraer datos crudos (SIN SUAVIZADO para preservar picos de pendiente)
  let datos = [];
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

  if (datos.length < 5) throw new Error("El archivo no contiene suficientes datos válidos.");

  // 3. Detectar inicio real (Toe Region) - Filtro de ruido estático
  const fuerza_maxima_absoluta = Math.max(...datos.map(d => d.fuerza));
  const UMBRAL_RUIDO = fuerza_maxima_absoluta * 0.005; // 0.5% del max
  
  let inicio_traccion = 0;
  for (let i = 0; i < datos.length; i++) {
    if (datos[i].fuerza > UMBRAL_RUIDO) { inicio_traccion = i; break; }
  }

  const desplazamiento_inicial = datos[inicio_traccion]?.desplazamiento || 0;
  
  // 4. Transformar a Tensión (MPa) y Deformación (mm/mm)
  let datos_ajustados = datos.slice(inicio_traccion).map(punto => {
    const desp_ajustado = punto.desplazamiento - desplazamiento_inicial;
    return {
      desplazamiento: desp_ajustado,
      fuerza: punto.fuerza,
      tension: (punto.fuerza * constante) / area,
      deformacion: desp_ajustado / distancia_usuario
    };
  });

  // --- CÁLCULO DE MÓDULO DE YOUNG (Ventana Deslizante) ---
  const tension_maxima = Math.max(...datos_ajustados.map(d => d.tension));
  
  // Rango de búsqueda: Evitamos el inicio curvo y el final plástico
  const limite_inferior = tension_maxima * 0.10; // 10%
  const limite_superior = tension_maxima * 0.60; // 60%

  // Ventana pequeña (6 puntos) para detectar pendientes empinadas locales
  const windowSize = 6; 

  let max_pendiente = 0;
  let mejor_r2 = 0;
  let mejor_b = 0; // Intersección para corregir el cero

  for (let i = 0; i < datos_ajustados.length - windowSize; i++) {
    const punto = datos_ajustados[i];
    
    // Filtro de rango
    if (punto.tension < limite_inferior) continue;
    if (punto.tension > limite_superior) break; // Salir si pasamos el rango

    const ventana = datos_ajustados.slice(i, i + windowSize);
    const puntos_regresion = ventana.map(p => ({ x: p.deformacion, y: p.tension }));
    
    const { m, r2, b } = regresionLineal(puntos_regresion);

    // Criterio: R2 > 0.96 (bastante recto) y Pendiente máxima
    if (r2 > 0.96 && m > max_pendiente) {
      max_pendiente = m;
      mejor_r2 = r2;
      mejor_b = b;
    }
  }

  // Fallback: Si no encuentra nada bueno en el rango 10-60%, busca en toda la subida con criterio relajado
  if (max_pendiente === 0) {
      for (let i = 0; i < datos_ajustados.length - windowSize; i += 2) {
          if (datos_ajustados[i].tension >= tension_maxima * 0.9) break;
          
          const ventana = datos_ajustados.slice(i, i + windowSize);
          const { m, r2, b } = regresionLineal(ventana.map(p => ({ x: p.deformacion, y: p.tension })));
          
          if (r2 > 0.90 && m > max_pendiente) {
              max_pendiente = m;
              mejor_b = b;
          }
      }
  }

  // Corrección de Cero (Offset)
  let offset_deformacion = 0;
  if (max_pendiente > 0 && mejor_b < 0) {
      offset_deformacion = -mejor_b / max_pendiente;
  }

  // Elongación corregida (Deformación máxima - offset)
  const max_deformacion_raw = Math.max(...datos_ajustados.map(d => d.deformacion));
  const deformacion_final = Math.max(0, max_deformacion_raw - offset_deformacion);
  
  return {
    tension_maxima: tension_maxima,
    elongacion_ruptura: deformacion_final * 100, // Convertir a Porcentaje (%)
    modulo_young: max_pendiente,
    datos_procesados: datos_ajustados.map(d => ({ 
      desplazamiento: d.desplazamiento, 
      fuerza: d.fuerza 
    })),
    metadatos: { area_archivo, r2: mejor_r2 }
  };
}

// --- RUTAS API ---

// 1. Autenticación
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  db.get('SELECT * FROM usuarios WHERE usuario = ?', [usuario], (err, row) => {
    if (err || !row) return res.status(401).json({ error: 'Credenciales inválidas' });
    
    bcrypt.compare(password, row.password, (err, ok) => {
      if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
      
      const token = jwt.sign(
        { id: row.id, usuario: row.usuario, rol: row.rol }, 
        JWT_SECRET, 
        { expiresIn: '24h' }
      );
      res.json({ 
        message: 'Login exitoso', 
        token, 
        usuario: { id: row.id, usuario: row.usuario, rol: row.rol } 
      });
    });
  });
});

app.get('/api/verify-token', verificarToken, (req, res) => {
  res.json({ valid: true, usuario: req.usuario });
});

// 2. Gestión de Usuarios (ADMINISTRADOR)
app.get('/api/usuarios', verificarToken, (req, res) => {
  if (req.usuario.rol !== 'administrador') return res.status(403).json({ error: 'Acceso denegado: Requiere Administrador' });
  
  db.all('SELECT id, usuario, rol, fecha_creacion FROM usuarios ORDER BY fecha_creacion DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener usuarios' });
    res.json(rows);
  });
});

app.post('/api/usuarios', verificarToken, async (req, res) => {
  if (req.usuario.rol !== 'administrador') return res.status(403).json({ error: 'Acceso denegado' });
  
  const { usuario, password, rol } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)', 
      [usuario, hashedPassword, rol || 'usuario'], 
      function(err) {
        if (err) return res.status(400).json({ error: 'El usuario ya existe' });
        res.json({ message: 'Usuario creado', id: this.lastID });
      }
    );
  } catch (e) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/api/usuarios/:id', verificarToken, (req, res) => {
  if (req.usuario.rol !== 'administrador') return res.status(403).json({ error: 'Acceso denegado' });
  
  db.get('SELECT usuario FROM usuarios WHERE id = ?', [req.params.id], (err, u) => {
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (u.usuario === 'FORPW') return res.status(403).json({ error: 'No se puede eliminar al administrador principal' });
    
    db.run('DELETE FROM usuarios WHERE id = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: 'Error al eliminar' });
      res.json({ message: 'Usuario eliminado correctamente' });
    });
  });
});

// 3. Gestión de Carpetas
app.get('/api/carpetas', verificarToken, (req, res) => {
  db.all(`
    SELECT c.*, COUNT(a.id) as total_analisis
    FROM carpetas c
    LEFT JOIN analisis a ON c.id = a.carpeta_id
    GROUP BY c.id
    ORDER BY c.nombre ASC
  `, [], (err, rows) => res.json(err ? [] : rows));
});

app.post('/api/carpetas', verificarToken, (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  
  db.run('INSERT INTO carpetas (nombre) VALUES (?)', [nombre.trim()], function(err) {
    if (err) return res.status(500).json({ error: 'Error al crear carpeta (posible duplicado)' });
    res.json({ id: this.lastID, nombre: nombre.trim() });
  });
});

app.delete('/api/carpetas/:id', verificarToken, (req, res) => {
  db.get('SELECT COUNT(*) as count FROM analisis WHERE carpeta_id = ?', [req.params.id], (err, row) => {
    if (row.count > 0) return res.status(400).json({ error: 'La carpeta no está vacía' });
    
    db.run('DELETE FROM carpetas WHERE id = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: 'Error al eliminar carpeta' });
      res.json({ message: 'Carpeta eliminada' });
    });
  });
});

// 4. Gestión de Análisis
app.get('/api/carpetas/:id/analisis', verificarToken, (req, res) => {
  db.all(`
    SELECT a.*, u.usuario as nombre_usuario, c.nombre as nombre_carpeta
    FROM analisis a 
    JOIN usuarios u ON a.usuario_id = u.id 
    JOIN carpetas c ON a.carpeta_id = c.id
    WHERE a.carpeta_id = ?
    ORDER BY a.fecha_analisis DESC
  `, [req.params.id], (err, rows) => res.json(err ? [] : rows));
});

app.post('/api/analisis', verificarToken, (req, res) => {
  const { area, distancia, constante, archivo_nombre, archivo_datos, carpeta_id } = req.body;
  
  if (!distancia || !archivo_datos || !carpeta_id) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    const resultados = procesarArchivoEnsayo(
      archivo_datos, 
      area ? parseFloat(area) : null, 
      parseFloat(distancia), 
      parseFloat(constante) || 0.949
    );
    
    const area_final = area ? parseFloat(area) : resultados.metadatos.area_archivo;

    db.run(`INSERT INTO analisis (
      usuario_id, carpeta_id, area, distancia, constante, 
      archivo_nombre, archivo_datos, datos_procesados, 
      tension_maxima, elongacion_ruptura, modulo_young
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [
        req.usuario.id, 
        carpeta_id, 
        area_final, 
        distancia, 
        constante || 0.949, 
        archivo_nombre, 
        archivo_datos, 
        JSON.stringify(resultados.datos_procesados), 
        resultados.tension_maxima, 
        resultados.elongacion_ruptura, 
        resultados.modulo_young
      ], 
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Error al guardar en base de datos' });
        }
        res.json({ message: 'Análisis guardado', id: this.lastID, resultados });
      });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/analisis/:id', verificarToken, (req, res) => {
  db.run('DELETE FROM analisis WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar análisis' });
    res.json({ message: 'Análisis eliminado' });
  });
});

app.get('/api/analisis/:id', verificarToken, (req, res) => {
  db.get(`
    SELECT a.*, u.usuario as nombre_usuario 
    FROM analisis a 
    JOIN usuarios u ON a.usuario_id = u.id 
    WHERE a.id = ?
  `, [req.params.id], (err, row) => {
    if (!row) return res.status(404).json({ error: 'Análisis no encontrado' });
    
    // Reconstruir datos para gráfica
    let datosGrafica = [];
    try {
      datosGrafica = JSON.parse(row.datos_procesados).map(p => ({
        desplazamiento: p.desplazamiento,
        fuerza: p.fuerza,
        tension: (p.fuerza * row.constante) / row.area,
        deformacion: p.desplazamiento / row.distancia
      }));
    } catch(e) {}

    res.json({ ...row, datos_grafica: datosGrafica });
  });
});

app.get('/api/analisis/:id/descargar-csv', verificarToken, (req, res) => {
  db.get('SELECT archivo_nombre, archivo_datos FROM analisis WHERE id = ?', [req.params.id], (err, row) => {
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${row.archivo_nombre}"`);
    res.send(row.archivo_datos);
  });
});

// 5. Datos Relevantes (Estadísticas)
app.get('/api/datos-relevantes', verificarToken, (req, res) => {
  db.all(`
    SELECT 
      c.id as carpeta_id, c.nombre as carpeta_nombre,
      COUNT(a.id) as total_analisis,
      AVG(a.tension_maxima) as avg_tension, AVG(a.elongacion_ruptura) as avg_elongacion, AVG(a.modulo_young) as avg_modulo,
      MAX(a.tension_maxima) as max_tension, MAX(a.elongacion_ruptura) as max_elongacion, MAX(a.modulo_young) as max_modulo
    FROM carpetas c
    LEFT JOIN analisis a ON c.id = a.carpeta_id
    GROUP BY c.id
    ORDER BY c.nombre ASC
  `, [], (err, rows) => res.json(err ? [] : rows));
});

app.get('/api/datos-relevantes/:carpeta_id', verificarToken, (req, res) => {
  db.all(`
    SELECT * FROM analisis WHERE carpeta_id = ? ORDER BY fecha_analisis DESC
  `, [req.params.carpeta_id], (err, rows) => res.json(err ? [] : rows));
});

// --- INICIO DEL SERVIDOR ---
process.on('SIGINT', () => { 
  db.close(); 
  process.exit(0); 
});

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose correctamente en puerto ${PORT}`);
});

module.exports = app;