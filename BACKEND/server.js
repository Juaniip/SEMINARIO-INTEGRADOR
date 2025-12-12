const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.ENV_PORT || 5000;
const JWT_SECRET = 'tu_jwt_secret_key_muy_segura_aqui';

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// Base de datos
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error('Error DB:', err.message);
  else console.log('Conectado a SQLite.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT DEFAULT 'usuario',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS carpetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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

  // Migraciones y Admin por defecto (Código abreviado para limpieza, mantener lógica original si es necesario)
  db.run(`INSERT OR IGNORE INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)`, 
    ['FORPW', bcrypt.hashSync('UTN2025SEM', 10), 'administrador']
  );
});

// Middleware JWT
const verificarToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) { res.status(401).json({ error: 'Token inválido' }); }
};

/**
 * FUNCIÓN DE REGRESIÓN LINEAL SIMPLE
 * Calcula la pendiente (m) y el coeficiente de determinación (r2) para un conjunto de puntos.
 */
function regresionLineal(puntos) {
  let n = puntos.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let p of puntos) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const denominador = (n * sumX2 - sumX * sumX);
  if (denominador === 0) return { m: 0, r2: 0 };

  const m = (n * sumXY - sumX * sumY) / denominador;
  
  // Cálculo de R2 (calidad del ajuste)
  const b = (sumY - m * sumX) / n;
  const ss_res = puntos.reduce((acc, p) => acc + Math.pow(p.y - (m * p.x + b), 2), 0);
  const mediaY = sumY / n;
  const ss_tot = puntos.reduce((acc, p) => acc + Math.pow(p.y - mediaY, 2), 0);
  const r2 = ss_tot === 0 ? 0 : 1 - (ss_res / ss_tot);

  return { m, r2 };
}

/**
 * LÓGICA PRINCIPAL DE CÁLCULO CIENTÍFICO
 * Actualizada con algoritmo de Ventana Deslizante para Módulo de Young
 */
function procesarArchivoEnsayo(contenidoCSV, area_usuario, distancia_usuario, constante = 0.949) {
  const lines = contenidoCSV.split('\n');
  let area_archivo = null;
  
  // 1. Leer metadatos
  for (let i = 0; i < 23; i++) {
    const line = lines[i];
    if (line.includes('Area;')) area_archivo = parseFloat(line.split(';')[1].replace(',', '.'));
  }

  const area = area_usuario || area_archivo;
  
  // 2. Extraer datos crudos
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

  // 3. Determinar Fuerza Máxima para filtrar ruido inicial
  const fuerza_maxima_absoluta = Math.max(...datos.map(d => d.fuerza));
  
  // 4. Filtrar "Zona de Pie" (Toe Region) dinámicamente
  // Ignoramos datos donde la fuerza es menor al 1.5% de la fuerza máxima (filtro de ruido)
  const UMBRAL_INICIO = fuerza_maxima_absoluta * 0.015; 
  let inicio_traccion = 0;
  for (let i = 0; i < datos.length; i++) {
    if (datos[i].fuerza > UMBRAL_INICIO) { inicio_traccion = i; break; }
  }

  const desplazamiento_inicial = datos[inicio_traccion]?.desplazamiento || 0;
  
  // 5. Generar curva Stress-Strain (Tensión-Deformación)
  const datos_ajustados = datos.slice(inicio_traccion).map(punto => {
    const desp_ajustado = punto.desplazamiento - desplazamiento_inicial;
    return {
      desplazamiento: desp_ajustado,
      fuerza: punto.fuerza,
      tension: (punto.fuerza * constante) / area, // MPa
      deformacion: desp_ajustado / distancia_usuario // Adimensional (mm/mm)
    };
  });

  if (datos_ajustados.length < 10) throw new Error("Datos insuficientes para análisis");

  // --- CÁLCULOS FINALES ---

  // A) Tensión Máxima
  const tension_maxima = Math.max(...datos_ajustados.map(d => d.tension));

  // B) Elongación de Ruptura (%)
  const max_desp_mm = Math.max(...datos_ajustados.map(d => d.desplazamiento));
  const elongacion_ruptura_porcentaje = (max_desp_mm / distancia_usuario) * 100;

  // C) Módulo de Young (Algoritmo de Ventana Deslizante)
  // En lugar de un rango fijo, buscamos la pendiente más empinada en la zona elástica.
  // Zona elástica teórica: usualmente entre el 5% y el 40% de la Tensión Máxima,
  // pero buscaremos la pendiente máxima estable en la primera mitad de la curva.
  
  let max_pendiente = 0;
  let mejor_r2 = 0;
  
  // Definimos el tamaño de la ventana (ej. 15 puntos o 5% de los datos totales)
  // Para archivos CSV con muchos puntos, una ventana más grande suaviza el ruido.
  const windowSize = Math.max(5, Math.floor(datos_ajustados.length * 0.03)); 
  
  // Solo analizamos hasta llegar a la tensión máxima (evitamos la zona de plasticidad/ruptura)
  const indice_pico = datos_ajustados.findIndex(d => d.tension === tension_maxima);
  const limite_busqueda = indice_pico > 0 ? indice_pico : datos_ajustados.length;

  for (let i = 0; i < limite_busqueda - windowSize; i += 2) { // Salto de 2 para optimizar
    const ventana = datos_ajustados.slice(i, i + windowSize);
    
    // Preparamos datos para regresión (x: deformación, y: tensión)
    const puntos_regresion = ventana.map(p => ({ x: p.deformacion, y: p.tension }));
    
    const { m, r2 } = regresionLineal(puntos_regresion);

    // Criterios para aceptar la pendiente:
    // 1. R2 debe ser decente (> 0.95) para asegurar que es una línea recta
    // 2. Buscamos la pendiente MAYOR (la parte más empinada representa el Módulo real sin deslizamiento)
    if (r2 > 0.98 && m > max_pendiente) {
      max_pendiente = m;
      mejor_r2 = r2;
    }
  }

  // Fallback: Si no encontramos una línea perfecta (r2 > 0.98), relajamos el criterio
  if (max_pendiente === 0) {
     for (let i = 0; i < limite_busqueda - windowSize; i += 5) {
        const ventana = datos_ajustados.slice(i, i + windowSize);
        const puntos_regresion = ventana.map(p => ({ x: p.deformacion, y: p.tension }));
        const { m, r2 } = regresionLineal(puntos_regresion);
        if (r2 > 0.90 && m > max_pendiente) { // Criterio relajado
            max_pendiente = m;
        }
     }
  }

  return {
    tension_maxima: tension_maxima || 0,
    elongacion_ruptura: elongacion_ruptura_porcentaje || 0,
    modulo_young: max_pendiente || 0,
    datos_procesados: datos_ajustados.map(d => ({ 
        desplazamiento: d.desplazamiento, 
        fuerza: d.fuerza 
    })),
    metadatos: { area_archivo, maximo_desplazamiento: max_desp_mm, r2_calculado: mejor_r2 }
  };
}

// === RUTAS ===

app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  db.get('SELECT * FROM usuarios WHERE usuario = ?', [usuario], (err, row) => {
    if (err || !row) return res.status(401).json({ error: 'Inválido' });
    bcrypt.compare(password, row.password, (err, ok) => {
      if (!ok) return res.status(401).json({ error: 'Inválido' });
      const token = jwt.sign({ id: row.id, usuario: row.usuario, rol: row.rol }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ message: 'OK', token, usuario: { id: row.id, usuario: row.usuario, rol: row.rol } });
    });
  });
});

app.get('/api/verify-token', verificarToken, (req, res) => res.json({ valid: true, usuario: req.usuario }));

app.get('/api/carpetas', verificarToken, (req, res) => {
  db.all(`SELECT c.*, COUNT(a.id) as total_analisis FROM carpetas c LEFT JOIN analisis a ON c.id = a.carpeta_id GROUP BY c.id ORDER BY c.nombre ASC`, [], (err, rows) => res.json(err ? [] : rows));
});

app.post('/api/carpetas', verificarToken, (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  db.run('INSERT INTO carpetas (nombre) VALUES (?)', [nombre.trim()], function(err) {
    if (err) return res.status(500).json({ error: 'Error al crear' });
    res.json({ id: this.lastID, nombre: nombre.trim() });
  });
});

app.delete('/api/carpetas/:id', verificarToken, (req, res) => {
  db.get('SELECT COUNT(*) as c FROM analisis WHERE carpeta_id = ?', [req.params.id], (err, r) => {
    if (r.c > 0) return res.status(400).json({ error: 'Carpeta no vacía' });
    db.run('DELETE FROM carpetas WHERE id = ?', [req.params.id], () => res.json({ message: 'Eliminada' }));
  });
});

app.get('/api/carpetas/:id/analisis', verificarToken, (req, res) => {
  db.all(`SELECT a.*, u.usuario as nombre_usuario FROM analisis a JOIN usuarios u ON a.usuario_id = u.id WHERE a.carpeta_id = ? ORDER BY a.fecha_analisis DESC`, [req.params.id], (err, rows) => res.json(err ? [] : rows));
});

app.get('/api/datos-relevantes', verificarToken, (req, res) => {
  db.all(`SELECT c.id as carpeta_id, c.nombre as carpeta_nombre, COUNT(a.id) as total_analisis, AVG(a.tension_maxima) as avg_tension, AVG(a.elongacion_ruptura) as avg_elongacion, AVG(a.modulo_young) as avg_modulo FROM carpetas c LEFT JOIN analisis a ON c.id = a.carpeta_id GROUP BY c.id ORDER BY c.nombre ASC`, [], (err, rows) => res.json(err ? [] : rows));
});

app.get('/api/datos-relevantes/:carpeta_id', verificarToken, (req, res) => {
    db.all(`SELECT * FROM analisis WHERE carpeta_id = ? ORDER BY fecha_analisis DESC`, [req.params.carpeta_id], (err, rows) => res.json(err ? [] : rows));
});

// POST ANÁLISIS
app.post('/api/analisis', verificarToken, (req, res) => {
  const { area, distancia, constante, archivo_nombre, archivo_datos, carpeta_id } = req.body;
  if (!distancia || !archivo_datos || !carpeta_id) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const resultados = procesarArchivoEnsayo(archivo_datos, area ? parseFloat(area) : null, parseFloat(distancia), parseFloat(constante) || 0.949);
    
    db.run(`INSERT INTO analisis (usuario_id, carpeta_id, area, distancia, constante, archivo_nombre, archivo_datos, datos_procesados, tension_maxima, elongacion_ruptura, modulo_young) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [req.usuario.id, carpeta_id, area ? parseFloat(area) : resultados.metadatos.area_archivo, distancia, constante, archivo_nombre, archivo_datos, JSON.stringify(resultados.datos_procesados), resultados.tension_maxima, resultados.elongacion_ruptura, resultados.modulo_young], 
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Guardado', id: this.lastID, resultados });
      });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/analisis/:id', verificarToken, (req, res) => {
  db.run('DELETE FROM analisis WHERE id = ?', [req.params.id], () => res.json({ message: 'Eliminado' }));
});

app.get('/api/analisis/:id/descargar-csv', verificarToken, (req, res) => {
  db.get('SELECT archivo_nombre, archivo_datos FROM analisis WHERE id = ?', [req.params.id], (err, row) => {
    if (!row) return res.status(404).json({ error: 'No existe' });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${row.archivo_nombre}"`);
    res.send(row.archivo_datos);
  });
});

app.get('/api/analisis/:id', verificarToken, (req, res) => {
  db.get(`SELECT a.*, u.usuario as nombre_usuario FROM analisis a JOIN usuarios u ON a.usuario_id = u.id WHERE a.id = ?`, [req.params.id], (err, row) => {
    if (!row) return res.status(404).json({ error: 'No encontrado' });
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

process.on('SIGINT', () => { db.close(); process.exit(0); });
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

module.exports = app;