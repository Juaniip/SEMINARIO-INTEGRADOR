import { useNavigate } from "react-router-dom";

const Login = ({ onLogin }) => {
  const navigate = useNavigate();

  const handleLogin = () => {
    onLogin();
    navigate("/");
  };

  return (
   <div className="page-container">
      <h1>Iniciar Sesión</h1>
      <button onClick={handleLogin}>Login</button>
    </div>
  );
};

export default Login;
