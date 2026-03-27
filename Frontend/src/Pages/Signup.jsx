import { useState, useContext } from "react";
import { MyContext } from "../MyContext";
import toast from "react-hot-toast";
import "./Signup.css";

function Signup() {
  const { setAuthMode } = useContext(MyContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        toast.success("Account created");
        setTimeout(() => window.location.reload(), 400);
      } else {
        toast.error(data.error || "Signup failed");
      }
    } catch {
      toast.error("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signupContainer">
      <div className="signupCard">
        <h2>Create account</h2>
        <p className="signupSub">Join ForgeChat today</p>

        <form className="signupForm" onSubmit={handleSignup}>
          <input
            className="signupInput"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="signupInput"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="passwordField">
            <input
              className="signupInput"
              type={showPassword ? "text" : "password"}
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className="passwordToggle" onClick={() => setShowPassword((prev) => !prev)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <input
            className="signupInput"
            type={showPassword ? "text" : "password"}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button className="signupButton" disabled={loading}>
            {loading ? "Creating..." : "Sign up"}
          </button>
        </form>

        <p className="authHint">Creating an account logs you in right away.</p>

        <p className="signupSwitch">
          Already have an account?
          <span onClick={() => setAuthMode("login")}> Login</span>
        </p>
      </div>
    </div>
  );
}

export default Signup;
