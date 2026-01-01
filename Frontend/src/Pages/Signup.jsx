import { useState, useContext } from "react";
import { MyContext } from "../MyContext";
import toast from "react-hot-toast";
import "./Signup.css";

function Signup() {
  const { setAuthMode } = useContext(MyContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Account created! Please login");
        setTimeout(() => setAuthMode("login"), 800);
      } else {
        toast.error(data.error || "Signup failed");
      }
    } catch {
      toast.error("Server error");
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
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="signupInput"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="signupInput"
            type="password"
            placeholder="Password (min 8 chars)"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="signupButton">Sign up</button>
        </form>

        <p className="signupSwitch">
          Already have an account?
          <span onClick={() => setAuthMode("login")}> Login</span>
        </p>
      </div>
    </div>
  );
}

export default Signup;
