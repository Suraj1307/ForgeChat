import { useContext, useMemo, useState } from "react";
import { MyContext } from "../MyContext";
import "./Signup.css";

const loadImageElement = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image."));
    image.src = src;
  });

const compressAvatarFile = async (file) => {
  const originalDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read image."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });

  const image = await loadImageElement(originalDataUrl);
  const maxDimension = 320;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);
  const compressed = canvas.toDataURL("image/webp", 0.86);
  return compressed.startsWith("data:image/webp") ? compressed : originalDataUrl;
};

const validateSignup = ({ name, email, password }) => {
  const errors = {};

  if (!name.trim()) {
    errors.name = "Name is required.";
  } else if (name.trim().length < 2) {
    errors.name = "Name should be at least 2 characters.";
  }

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return errors;
};

function Signup({ onSwitchMode }) {
  const { login } = useContext(MyContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [status, setStatus] = useState({ type: "", message: "" });

  const errors = useMemo(() => validateSignup({ name, email, password }), [name, email, password]);

  const setFieldTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setStatus({ type: "error", message: "Use a PNG, JPG, JPEG, or WEBP image." });
      event.target.value = "";
      return;
    }

    if (file.size > 1500000) {
      setStatus({ type: "error", message: "Keep profile images under 1.5 MB." });
      event.target.value = "";
      return;
    }

    try {
      const nextAvatarUrl = await compressAvatarFile(file);
      setAvatarUrl(nextAvatarUrl);
      setStatus({ type: "", message: "" });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Unable to load that image." });
    } finally {
      event.target.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ name: true, email: true, password: true });

    if (Object.keys(errors).length > 0) {
      setStatus({ type: "error", message: "Please fix the highlighted fields." });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          avatarUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed.");
      }

      setStatus({ type: "success", message: "Account created successfully." });
      login({ token: data.token, user: data.user });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signupPanel">
      <div className="signupHeader">
        <h2>Create account</h2>
        <p>Start using ForgeChat with a cleaner, faster workspace for your conversations.</p>
      </div>

      <form className="signupForm" onSubmit={handleSubmit} noValidate>
        <label className="signupAvatarField">
          <span>Profile picture</span>
          <div className="signupAvatarRow">
            <div className="signupAvatarPreview" aria-hidden="true">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <i className="fa-solid fa-user"></i>
              )}
            </div>

            <div className="signupAvatarActions">
              <label className="signupAvatarButton">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                />
                <span>{avatarUrl ? "Change photo" : "Upload photo"}</span>
              </label>

              {avatarUrl && (
                <button
                  type="button"
                  className="signupAvatarRemove"
                  onClick={() => {
                    setAvatarUrl("");
                    setStatus({ type: "", message: "" });
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <small className="signupAvatarHint">Optional. PNG, JPG, JPEG, or WEBP under 1.5 MB.</small>
        </label>

        <label className="signupField">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setStatus({ type: "", message: "" });
            }}
            onBlur={() => setFieldTouched("name")}
            placeholder="Your full name"
            className={touched.name && errors.name ? "hasError" : ""}
          />
          {touched.name && errors.name && <small>{errors.name}</small>}
        </label>

        <label className="signupField">
          <span>Email</span>
          <input
            type="email"
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

        <label className="signupField">
          <span>Password</span>
          <div className="signupPasswordWrap">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setStatus({ type: "", message: "" });
              }}
              onBlur={() => setFieldTouched("password")}
              placeholder="Minimum 8 characters"
              className={touched.password && errors.password ? "hasError" : ""}
            />
            <button
              type="button"
              className="signupPasswordToggle"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {touched.password && errors.password && <small>{errors.password}</small>}
        </label>

        <button type="submit" className={`signupButton ${loading ? "isLoading" : ""}`} disabled={loading}>
          <span>{loading ? "Creating account..." : "Create account"}</span>
        </button>

        {status.message && <div className={`signupMessage ${status.type}`}>{status.message}</div>}
      </form>

      <p className="signupSwitch">
        Already have an account?
        <button type="button" className="signupSwitchButton" onClick={onSwitchMode}>
          Login
        </button>
      </p>
    </div>
  );
}

export default Signup;
