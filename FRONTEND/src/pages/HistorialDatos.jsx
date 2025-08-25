import "./Historial.css";

const HistorialDatos = () => {
  // Datos de ejemplo, también podrían venir de la BD
  const datos = [
    { id: 1, titulo: "Promedio resistencia", valor: "45.2 MPa" },
    { id: 2, titulo: "Máxima elongación", valor: "12.5 mm" },
  ];

  return (
    <div className="historial-container">
      <h2>Historial de Datos Relevantes</h2>
      <ul>
        {datos.map((d) => (
          <li key={d.id}>
            <strong>{d.titulo}:</strong> {d.valor}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HistorialDatos;
