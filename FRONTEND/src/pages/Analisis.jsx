import { useState } from "react";
import "./AnalisisForm.css";

const AnalisisForm = () => {
  const [formData, setFormData] = useState({
    numero1: "",
    numero2: "",
    numero3: "",
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
    console.log("Datos enviados:", formData);
    // acá podrías mandar formData a un backend o procesar el csv
  };

  return (
    <form className="analisis-form" onSubmit={handleSubmit}>
      <h2>Formulario de Análisis</h2>

      <label>
        Número 1:
        <input
          type="number"
          name="numero1"
          value={formData.numero1}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Número 2:
        <input
          type="number"
          name="numero2"
          value={formData.numero2}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Número 3:
        <input
          type="number"
          name="numero3"
          value={formData.numero3}
          onChange={handleChange}
          required
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
