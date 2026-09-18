import { useContext, useMemo, useState } from "react";
import { MyContext } from "../MyContext";
import { getApiErrorMessage, readApiPayload } from "../utils/api";
import "./Login.css";

const validateLogin = ({ email, password }) => {
  const errors = {};

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  }

  return errors;
};

function Login({ onSwitchMode }) {
  const { login } = useContext(MyContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [status, setStatus] = useState({ type: "", message: "" });

  const errors = useMemo(() => validateLogin({ email, password }), [email, password]);

  const setFieldTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ email: true, password: true });

    if (Object.keys(errors).length > 0) {
      setStatus({ type: "error", message: "Please fix the highlighted fields." });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          rememberMe,
        }),
      });

      const data = await readApiPayload(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, data, "Login failed."));
      }

      setStatus({ type: "success", message: "Signed in successfully." });
      login({ token: data.token, user: data.user });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authPanel loginPanel">
      <div className="authHeader">
        <h2>Welcome back</h2>
        <p>Please enter your details to continue.</p>
      </div>

      <form className="authForm" onSubmit={handleSubmit} noValidate>
        <label className="authField">
          <span>Email Address</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setStatus({ type: "", message: "" });
            }}
            onBlur={() => setFieldTouched("email")}
            placeholder="you@example.com"
            className={touched.email && errors.email ? "hasError" : ""}
          />
          {touched.email && errors.email && <small>{errors.email}</small>}
        </label>

        <label className="authField">
          <span>Password</span>
          <div className="authPasswordWrap">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setStatus({ type: "", message: "" });
              }}
              onBlur={() => setFieldTouched("password")}
              placeholder="Enter your password"
              className={touched.password && errors.password ? "hasError" : ""}
            />
            <button
              type="button"
              className="authGhostButton"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {touched.password && errors.password && <small>{errors.password}</small>}
        </label>

        <div className="authInlineRow">
          <label className="authCheckbox">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>

          <button
            type="button"
            className="authTextButton"
            onClick={() =>
              setStatus({
                type: "info",
                message: "Forgot-password flow is not wired yet, but this UI is ready for it.",
              })
            }
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          className={`authPrimaryButton ${loading ? "isLoading" : ""}`}
          disabled={loading}
        >
          <span>{loading ? "Signing in..." : "Sign In"}</span>
        </button>

        {status.message && <div className={`authMessage ${status.type}`}>{status.message}</div>}
      </form>

      <p className="authSwitch">
        Don&apos;t have an account?
        <button type="button" className="authSwitchButton" onClick={onSwitchMode}>
          Sign Up
        </button>
      </p>
    </div>
  );
}

export default Login;
