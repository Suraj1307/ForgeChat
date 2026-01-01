import { useState, useContext } from "react";
import { MyContext } from "../MyContext";
import toast from "react-hot-toast";
import "./Login.css";

function Login() {
  const { setAuthMode } = useContext(MyContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        toast.success("Logged in successfully");
        setTimeout(() => window.location.reload(), 600);
      } else {
        toast.error(data.error || "Login failed");
      }
    } catch {
      toast.error("Server error");
    }
  };

  return (
    <div className="loginContainer">
      <div className="loginCard">
        <h2>Welcome back</h2>
        <p className="loginSub">Login to your ForgeChat account</p>

        <form className="loginForm" onSubmit={handleLogin}>
          <input
            className="loginInput"
            type="email"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="loginInput"
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="loginButton">Login</button>
        </form>

        <p className="loginSwitch">
          Don’t have an account?
          <span onClick={() => setAuthMode("signup")}> Sign up</span>
        </p>
      </div>
    </div>
  );
}

export default Login;
