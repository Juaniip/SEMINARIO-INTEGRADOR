import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import Chart from 'chart.js/auto';
import "./ReporteAnalisis.css";

const ReporteAnalisis = () => {
  const { id } = useParams();
  const [analisis, setAnalisis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    cargarAnalisis();
    return () => {
      // Limpiar gráfica al desmontar componente
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [id]);

  useEffect(() => {
    if (analisis && analisis.datos_grafica && chartRef.current) {
      crearGrafica();
    }
  }, [analisis]);

  const cargarAnalisis = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("No hay sesión activa");
        setLoading(false);
        return;
      }

      const response = await fetch(`http://localhost:5000/api/analisis/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setAnalisis(data);
      } else {
        setError(data.error || 'Error al cargar análisis');
      }
    } catch (error) {
      console.error('Error al cargar análisis:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const crearGrafica = () => {
    // Destruir gráfica anterior si existe
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    
    // Preparar datos para la gráfica
    const datosGrafica = analisis.datos_grafica.map(punto => ({
      x: punto.deformacion,
      y: punto.tension
    }));

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Tensión vs Deformación',
          data: datosGrafica,
          borderColor: '#007bff',
          backgroundColor: 'rgba(0, 123, 255, 0.1)',
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Curva Tensión-Deformación',
            font: { size: 18, weight: 'bold' }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: 'Deformación (adimensional)',
              font: { size: 14, weight: 'bold' }
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Tensión (MPa)',
              font: { size: 14, weight: 'bold' }
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  };

  const formatearFecha = (fechaString) => {
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-AR') + ' ' + fecha.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const descargarCSV = async () => {
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
        a.download = analisis.archivo_nombre || `archivo_original_${id}.csv`;
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

  const descargarPDF = () => {
    // Usar la funcionalidad nativa del navegador para imprimir/guardar como PDF
    const originalTitle = document.title;
    document.title = `Reporte_Analisis_${id}`;
    
    // Crear estilos específicos para impresión
    const printStyles = document.createElement('style');
    printStyles.textContent = `
      @media print {
        body * { visibility: hidden; }
        .reporte-container, .reporte-container * { visibility: visible; }
        .reporte-container { 
          position: absolute; 
          left: 0; 
          top: 0; 
          width: 100%; 
          background: white;
          padding: 20px;
        }
        .acciones-header { display: none !important; }
        .chart-wrapper { 
          page-break-inside: avoid; 
          height: 400px !important;
        }
        .info-grid { 
          page-break-inside: avoid; 
        }
        .reporte-header {
          page-break-after: avoid;
        }
      }
    `;
    document.head.appendChild(printStyles);
    
    // Activar modo de impresión
    setTimeout(() => {
      window.print();
      
      // Limpiar después de imprimir
      setTimeout(() => {
        document.head.removeChild(printStyles);
        document.title = originalTitle;
      }, 1000);
    }, 500);
  };

  if (loading) {
    return (
      <div className="reporte-container">
        <h2>Cargando reporte...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reporte-container">
        <h2>Error al cargar reporte</h2>
        <div style={{ color: 'red' }}>Error: {error}</div>
        <Link to="/historial-analisis" className="btn-volver">
          Volver al historial
        </Link>
      </div>
    );
  }

  if (!analisis) {
    return (
      <div className="reporte-container">
        <h2>Análisis no encontrado</h2>
        <Link to="/historial-analisis" className="btn-volver">
          Volver al historial
        </Link>
      </div>
    );
  }

  return (
    <div className="reporte-container">
      {/* Header */}
      <div className="reporte-header">
        <h1>Reporte de Análisis Mecánico</h1>
        <div className="header-info">
          <span><strong>ID:</strong> {analisis.id}</span>
          <span><strong>Fecha:</strong> {formatearFecha(analisis.fecha_analisis)}</span>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="acciones-header">
        <Link to="/historial-analisis" className="btn-volver">
          ← Volver al historial
        </Link>
        <div className="botones-descarga">
          <button onClick={descargarCSV} className="btn-descargar">
            📄 Descargar CSV Original
          </button>
          <button onClick={descargarPDF} className="btn-pdf">
            📊 Descargar Reporte PDF
          </button>
        </div>
      </div>

      {/* Información del análisis */}
      <div className="info-grid">
        <div className="info-section">
          <h3>Información General</h3>
          <div className="info-item">
            <span className="label">Usuario:</span>
            <span className="value">{analisis.nombre_usuario}</span>
          </div>
          <div className="info-item">
            <span className="label">Archivo Original:</span>
            <span className="value">{analisis.archivo_nombre || 'N/A'}</span>
          </div>
          <div className="info-item">
            <span className="label">Área (mm²):</span>
            <span className="value">{analisis.area}</span>
          </div>
          <div className="info-item">
            <span className="label">Distancia entre mordazas (mm):</span>
            <span className="value">{analisis.distancia}</span>
          </div>
          <div className="info-item">
            <span className="label">Constante:</span>
            <span className="value">{analisis.constante}</span>
          </div>
        </div>

        <div className="info-section resultados">
          <h3>Resultados Calculados</h3>
          <div className="resultado-destacado">
            <div className="resultado-valor">
              {analisis.tension_maxima ? analisis.tension_maxima.toFixed(3) : 'N/A'}
            </div>
            <div className="resultado-label">Tensión Máxima (MPa)</div>
          </div>
          <div className="resultado-destacado">
            <div className="resultado-valor">
              {analisis.elongacion_ruptura ? analisis.elongacion_ruptura.toFixed(3) : 'N/A'}
            </div>
            <div className="resultado-label">Elongación de Ruptura (mm)</div>
          </div>
          <div className="resultado-destacado">
            <div className="resultado-valor">
              {analisis.modulo_young ? analisis.modulo_young.toFixed(3) : 'N/A'}
            </div>
            <div className="resultado-label">Módulo de Young (MPa)</div>
          </div>
        </div>
      </div>

      {/* Gráfica */}
      <div className="grafica-container">
        <h3>Curva Tensión-Deformación</h3>
        <div className="chart-wrapper">
          <canvas ref={chartRef} id="grafica"></canvas>
        </div>
      </div>
    </div>
  );
};

export default ReporteAnalisis;