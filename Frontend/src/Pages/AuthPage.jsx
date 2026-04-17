import { useContext } from "react";
import { MyContext } from "../MyContext";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import "./AuthPage.css";

function AuthPage() {
  const { authMode, setAuthMode } = useContext(MyContext);
  const isSignup = authMode === "signup";

  return (
    <div className="authShell">
      <div className="authLayout">
        <section className="authCard authCardSingle">
          <div className="authCardTop">
            <div className="authTabs" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignup}
                className={!isSignup ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignup}
                className={isSignup ? "active" : ""}
                onClick={() => setAuthMode("signup")}
              >
                Sign up
              </button>
            </div>
          </div>

          <div className={`authContentSwap ${isSignup ? "signupMode" : "loginMode"}`}>
            {isSignup ? (
              <Signup onSwitchMode={() => setAuthMode("login")} />
            ) : (
              <Login onSwitchMode={() => setAuthMode("signup")} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AuthPage;
