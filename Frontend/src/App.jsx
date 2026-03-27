import "./App.css";
import { lazy, Suspense, useState } from "react";
import { v1 as uuidv1 } from "uuid";
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import { MyContext } from "./MyContext.jsx";

const Login = lazy(() => import("./Pages/Login.jsx"));
const Signup = lazy(() => import("./Pages/Signup.jsx"));

function App() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState(null);
  const [streamReply, setStreamReply] = useState("");
  const [currThreadId, setCurrThreadId] = useState(uuidv1());
  const [prevChats, setPrevChats] = useState([]);
  const [newChat, setNewChat] = useState(true);
  const [allThreads, setAllThreads] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [authMode, setAuthMode] = useState("login");

  const providerValues = {
    prompt,
    setPrompt,
    reply,
    setReply,
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
  };

  const isAuthenticated = !!localStorage.getItem("token");

  return (
    <div className="app">
      <MyContext.Provider value={providerValues}>
        <Suspense fallback={<div className="screenLoader">Loading ForgeChat...</div>}>
          {isAuthenticated ? (
            <div className="mainLayout">
              <Sidebar />
              <ChatWindow />
            </div>
          ) : authMode === "login" ? (
            <Login />
          ) : (
            <Signup />
          )}
        </Suspense>
      </MyContext.Provider>
    </div>
  );
}

export default App;
