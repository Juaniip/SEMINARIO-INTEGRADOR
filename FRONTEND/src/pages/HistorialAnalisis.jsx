import "./Historial.css";

const HistorialAnalisis = () => {
  // Esto podría venir de un backend o base de datos
    const analisis = [
        { id: 1, fecha: "2025-08-20", usuario: "Juan", archivo: "analisis1.csv" },
        { id: 2, fecha: "2025-08-21", usuario: "María", archivo: "ensayo2.csv" },
    ];

    return (
        <div className="historial-container">
        <h2>Historial de Análisis</h2>
        <ul>
            {analisis.map((a) => (
            <li key={a.id}>
                <strong>{a.fecha}</strong> - {a.usuario} - {a.archivo}
            </li>
            ))}
        </ul>
        </div>
    );
};

export default HistorialAnalisis;
