import "./Sidebar.css";
import { useContext, useEffect } from "react";
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
  } = useContext(MyContext);

  const getAllThreads = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch("/api/thread", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await response.json();
      if (response.ok && Array.isArray(res)) {
        setAllThreads(res);
      }
    } catch (err) {
      console.error("Sidebar load error:", err);
    }
  };

  useEffect(() => {
    getAllThreads();
  }, [currThreadId]);

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

    const token = localStorage.getItem("token");
    setCurrThreadId(id);

    try {
      const response = await fetch(`/api/thread/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`/api/thread/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setAllThreads((prev) => prev.filter((t) => t.threadId !== id));
        if (id === currThreadId) createNewChat();
        toast.success("Deleted");
      }
    } catch {
      toast.error("Delete failed");
    }
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
            <img src={logoImg} alt="ForgeChat Logo" className="nav-logo-large" />
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
          <ul className="history-list">
            {allThreads?.map((thread) => (
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
        </div>

        <div className="sidebar-footer">
          <div className="made-by-signature">
            Made with <span className="heart-red">&#10084;&#65039;</span> by Suraj
          </div>
        </div>
      </section>
    </>
  );
}

export default Sidebar;
