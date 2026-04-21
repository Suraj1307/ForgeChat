import "./Sidebar.css";
import { useCallback, useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import { v1 as uuidv1 } from "uuid";
import toast from "react-hot-toast";
import logoImg from "./assets/blacklogo.png";

function Sidebar() {
  const {
    allThreads,
    setAllThreads,
    currThreadId,
    setNewChat,
    setPrompt,
    setReply,
    setStreamReply,
    setCurrThreadId,
    setPrevChats,
    isSidebarOpen,
    setIsSidebarOpen,
    setAttachedFile,
    authToken,
    logout,
    threadsRevision,
    cancelActiveStream,
  } = useContext(MyContext);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState("");

  const getAllThreads = useCallback(async () => {
    if (!authToken) return;

    setThreadsLoading(true);
    setThreadsError("");

    try {
      const response = await fetch("/api/thread", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.status === 401) {
        logout();
        return;
      }

      const res = await response.json();
      if (response.ok && Array.isArray(res)) {
        setAllThreads(res);
      } else {
        setThreadsError("Could not load your chats.");
      }
    } catch (err) {
      console.error("Sidebar load error:", err);
      setThreadsError("Could not load your chats.");
    } finally {
      setThreadsLoading(false);
    }
  }, [authToken, logout, setAllThreads]);

  useEffect(() => {
    getAllThreads();
  }, [getAllThreads, threadsRevision]);

  useEffect(() => {
    if (!isSidebarOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isSidebarOpen]);

  const resetComposerState = () => {
    setPrompt("");
    setReply(null);
    setStreamReply("");
    setAttachedFile(null);
  };

  const createNewChat = () => {
    cancelActiveStream();
    setNewChat(true);
    setCurrThreadId(uuidv1());
    setPrevChats([]);
    resetComposerState();
    setIsSidebarOpen(false);
  };

  const changeThread = async (id) => {
    if (id === currThreadId) {
      setIsSidebarOpen(false);
      return;
    }

    cancelActiveStream();
    setCurrThreadId(id);

    try {
      const response = await fetch(`/api/thread/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.status === 401) {
        logout();
        return;
      }

      const res = await response.json();
      if (response.ok) {
        setPrevChats(res);
        setNewChat(false);
        resetComposerState();
        setIsSidebarOpen(false);
      }
    } catch {
      toast.error("Error loading chat");
    }
  };

  const deleteThread = async (id) => {
    cancelActiveStream();
    try {
      const response = await fetch(`/api/thread/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.status === 401) {
        logout();
        return;
      }

      if (response.ok) {
        setAllThreads((prev) => prev.filter((t) => t.threadId !== id));
        if (id === currThreadId) createNewChat();
        toast.success("Deleted");
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleLogout = () => {
    cancelActiveStream();
    logout();
    toast.success("Logged out");
  };

  return (
    <>
      <button
        type="button"
        className={`sidebar-backdrop ${isSidebarOpen ? "visible" : ""}`}
        aria-label="Close sidebar"
        onClick={() => setIsSidebarOpen(false)}
      />

      <section className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="nav-top">
            <div className="sidebar-brand">
              <img src={logoImg} alt="ForgeChat Logo" className="nav-logo-large" />
              <div className="sidebar-brand-copy">
                <strong>ForgeChat</strong>
                <span>Your workspace</span>
              </div>
            </div>
            <div className="sidebar-top-actions">
              <button
                type="button"
                className="icon-button"
                onClick={createNewChat}
                title="New Chat"
                aria-label="New chat"
              >
                <i className="fa-regular fa-pen-to-square new-icon"></i>
              </button>
              <button
                type="button"
                className="icon-button sidebar-close"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <button type="button" className="menu-item-new" onClick={createNewChat}>
            <div className="plus-icon-circle">
              <i className="fa-solid fa-plus"></i>
            </div>
            <span>New chat</span>
          </button>
        </div>

        <div className="history-container">
          <div className="section-label">Your chats</div>
          {threadsLoading ? (
            <div className="historyState">
              <div className="historyLoadingDots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>Loading your chats...</p>
            </div>
          ) : threadsError ? (
            <div className="historyState error">
              <p>{threadsError}</p>
              <button type="button" className="historyRetryButton" onClick={getAllThreads}>
                Try again
              </button>
            </div>
          ) : allThreads?.length ? (
            <ul className="history-list">
              {allThreads.map((thread) => (
                <li
                  key={thread.threadId}
                  onClick={() => changeThread(thread.threadId)}
                  className={thread.threadId === currThreadId ? "active" : ""}
                >
                  <span className="title-text">{thread.title || "Untitled Chat"}</span>
                  <button
                    type="button"
                    className="thread-action-button"
                    aria-label={`Delete ${thread.title || "chat"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(thread.threadId);
                    }}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="historyState">
              <p>No chats yet.</p>
              <span>Start a new conversation to see it here.</span>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-card">
            <button type="button" className="sidebarLogoutButton" onClick={handleLogout}>
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
              <span>Log out</span>
            </button>
            <div className="made-by-signature">
              Made with <span className="heart-red">&#10084;&#65039;</span> by Suraj
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Sidebar;
