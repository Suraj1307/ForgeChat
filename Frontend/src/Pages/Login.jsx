import { useState, useContext } from "react";
import { MyContext } from "../MyContext";
import toast from "react-hot-toast";
import "./Login.css";

function Login() {
  const { setAuthMode } = useContext(MyContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        toast.success("Logged in successfully");
        setTimeout(() => window.location.reload(), 400);
      } else {
        toast.error(data.error || "Login failed");
      }
    } catch {
      toast.error("Server error");
    } finally {
      setLoading(false);
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="passwordField">
            <input
              className="loginInput"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className="passwordToggle" onClick={() => setShowPassword((prev) => !prev)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button className="loginButton" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="authHint">Your session stays active for 7 days after login.</p>

        <p className="loginSwitch">
          Don't have an account?
          <span onClick={() => setAuthMode("signup")}> Sign up</span>
        </p>
      </div>
    </div>
  );
}

export default Login;
