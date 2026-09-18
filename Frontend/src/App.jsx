import "./App.css";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { v1 as uuidv1 } from "uuid";
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import { MyContext } from "./MyContext.jsx";
import { apiFetch, apiRequest, createAuthHeaders, isUnauthorizedResponse } from "./utils/api.js";

const AuthPage = lazy(() => import("./Pages/AuthPage.jsx"));

function App() {
  const [prompt, setPrompt] = useState("");
  const [streamReply, setStreamReply] = useState("");
  const [currThreadId, setCurrThreadId] = useState(uuidv1());
  const [prevChats, setPrevChats] = useState([]);
  const [newChat, setNewChat] = useState(true);
  const [allThreads, setAllThreads] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("token") || "");
  const [authUser, setAuthUser] = useState(null);
  const [threadsRevision, setThreadsRevision] = useState(0);
  const [cancelActiveStream, setCancelActiveStream] = useState(() => () => {});

  const resetChatState = () => {
    setPrompt("");
    setStreamReply("");
    setPrevChats([]);
    setAllThreads([]);
    setAttachedFile(null);
    setNewChat(true);
    setCurrThreadId(uuidv1());
    setIsSidebarOpen(false);
  };

  const login = useCallback(({ token, user }) => {
    localStorage.setItem("token", token);
    setAuthToken(token);
    setAuthUser(user || null);
    setAuthMode("login");
  }, []);

  const logout = useCallback(() => {
    cancelActiveStream();
    const activeToken = localStorage.getItem("token");
    if (activeToken) {
      void apiFetch("/api/logout", {
        method: "POST",
        headers: createAuthHeaders(activeToken),
      }).catch(() => {});
    }
    localStorage.removeItem("token");
    setAuthToken("");
    setAuthUser(null);
    setAuthMode("login");
    resetChatState();
    window.setTimeout(() => {
      window.location.replace("/");
    }, 0);
  }, [cancelActiveStream]);

  const bumpThreadsRevision = () => {
    setThreadsRevision((prev) => prev + 1);
  };

  useEffect(() => {
    if (!authToken) return undefined;

    let isActive = true;

    const syncSession = async () => {
      try {
        const { response, payload } = await apiRequest("/api/me", {
          headers: createAuthHeaders(authToken),
        });

        if (!isActive) {
          return;
        }

        if (response.ok) {
          setAuthUser(payload);
          return;
        }

        if (isUnauthorizedResponse(response)) {
          logout();
          return;
        }

        setAuthUser((currentUser) => currentUser ?? null);
      } catch {
        if (isActive) {
          setAuthUser((currentUser) => currentUser ?? null);
        }
      }
    };

    void syncSession();

    return () => {
      isActive = false;
    };
  }, [authToken, logout]);

  const providerValues = {
    prompt,
    setPrompt,
    streamReply,
    setStreamReply,
    currThreadId,
    setCurrThreadId,
    newChat,
    setNewChat,
    prevChats,
    setPrevChats,
    allThreads,
    setAllThreads,
    authMode,
    setAuthMode,
    isSidebarOpen,
    setIsSidebarOpen,
    attachedFile,
    setAttachedFile,
    authToken,
    authUser,
    setAuthUser,
    isAuthenticated: !!authToken,
    login,
    logout,
    threadsRevision,
    bumpThreadsRevision,
    cancelActiveStream,
    setCancelActiveStream,
  };

  return (
    <div className="app">
      <MyContext.Provider value={providerValues}>
        <Suspense fallback={<div className="screenLoader">Loading ForgeChat...</div>}>
          {authToken ? (
            <div className="mainLayout">
              <Sidebar />
              <ChatWindow />
            </div>
          ) : (
            <AuthPage />
          )}
        </Suspense>
      </MyContext.Provider>
    </div>
  );
}

export default App;
