import { useState } from "react";
import "./AnalisisForm.css";

const AnalisisForm = ({ usuario }) => {
  const [formData, setFormData] = useState({
    area: "",
    distancia: "",
    constante: 0.949,
    archivo: null,
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Datos enviados:", { ...formData, usuario });
    // acá podrías mandar formData a un backend o procesar el csv
  };

  return (
    <form className="analisis-form" onSubmit={handleSubmit}>
      <h2>Formulario de Análisis</h2>

      <div className="usuario-info">
        <strong>Usuario:</strong> {usuario || "Invitado"}
      </div>

      <label>
        Área de los especímenes (mm²):
        <input
          type="number"
          name="area"
          value={formData.area}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Distancia entre mordazas (mm):
        <input
          type="number"
          name="distancia"
          value={formData.distancia}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Constante:
        <input
          type="number"
          step="0.001"
          name="constante"
          value={formData.constante}
          onChange={handleChange}
        />
      </label>

      <label>
        Subir archivo CSV:
        <input
          type="file"
          name="archivo"
          accept=".csv"
          onChange={handleChange}
          required
        />
      </label>

      <button type="submit">Enviar</button>
    </form>
  );
};

export default AnalisisForm;
