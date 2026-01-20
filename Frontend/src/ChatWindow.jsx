import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect } from "react";
import { ScaleLoader } from "react-spinners";
import toast from "react-hot-toast";

function ChatWindow() {
  const {
    prompt,
    setPrompt,
    reply,
    setReply,
    currThreadId,
    setPrevChats,
    setNewChat,
    allThreads,    // Added to update sidebar titles
    setAllThreads, // Added to update sidebar titles
  } = useContext(MyContext);

  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);

  // FETCH LOGGED-IN USER
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch("/api/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setUser(data))
      .catch(() => console.log("User not loaded"));
  }, []);

  // GET REPLY
  const getReply = async () => {
    if (!prompt.trim() || loading) return;

    const userMsg = prompt; // Capture prompt before clearing
    setPrompt("");          // Clear input immediately for better UX
    setLoading(true);
    setNewChat(false);

    // 1. Optimistic Update: Show user message in UI immediately
    setPrevChats((prev) => [...prev, { role: "user", content: userMsg }]);

    const token = localStorage.getItem("token");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMsg,
          threadId: currThreadId,
        }),
      });

      const res = await response.json();
      
      if (response.ok) {
        setReply(res.reply);
      } else {
        toast.error("Failed to get response");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // APPEND ASSISTANT REPLY TO HISTORY
  useEffect(() => {
    if (reply) {
      setPrevChats((prev) => [
        ...prev,
        { role: "assistant", content: reply },
      ]);
      
      // Reset reply global state to prevent infinite loops/double triggers
      setReply(null);
    }
  }, [reply]);

  const handleProfileClick = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = () => {
    localStorage.clear();
    toast.success("Logged out");
    window.location.href = "/login";
  };

  return (
    <div className="chatWindow" data-theme="dark">
      {/* NAVBAR */}
      <div className="navbar">
        <span>ForgeChat</span>

        <div className="userIconDiv" onClick={handleProfileClick}>
          <span className="userIcon">
            <i className="fa-solid fa-user"></i>
          </span>
        </div>
      </div>

      {/* PROFILE DROPDOWN */}
      {isOpen && (
        <div className="dropDown">
          <div className="dropDownHeader">
            <i className="fa-solid fa-user"></i>
            <div>
              <p className="userName">{user?.name || "User"}</p>
              <p className="userEmail">{user?.email || "No email"}</p>
            </div>
          </div>

          <div className="dropDownItem logout" onClick={handleLogout}>
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            Log out
          </div>
        </div>
      )}

      {/* CHAT AREA */}
      <Chat />

      {/* LOADER */}
      <div className="loaderDiv">
        <ScaleLoader color="#fff" loading={loading} height={20} />
      </div>

      {/* INPUT */}
      <div className="chatInput">
        <div className="inputBox">
          <input
            placeholder="Ask anything..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            // Prevent sending if empty or loading
            onKeyDown={(e) => (e.key === "Enter" && !e.shiftKey ? getReply() : null)}
          />
          <div 
            id="submit" 
            onClick={getReply} 
            className={!prompt.trim() || loading ? "disabled" : ""}
          >
            <i className="fa-solid fa-paper-plane"></i>
          </div>
        </div>

        <p className="info">
          ForgeChat can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}

export default ChatWindow;