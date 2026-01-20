import "./Sidebar.css";
import { useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import { v1 as uuidv1 } from "uuid";
import toast from "react-hot-toast";

// Import your logo
import logoImg from "./assets/blacklogo.png"; 

function Sidebar() {
  const {
    allThreads,
    setAllThreads,
    currThreadId,
    setNewChat,
    setPrompt,
    setReply,
    setCurrThreadId,
    setPrevChats
  } = useContext(MyContext);

  const getAllThreads = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch("/api/thread", {
        headers: { Authorization: `Bearer ${token}` }
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

  const createNewChat = () => {
    setNewChat(true);
    setPrompt("");
    setReply(null);
    setCurrThreadId(uuidv1());
    setPrevChats([]);
  };

  const changeThread = async (id) => {
    if (id === currThreadId) return;
    const token = localStorage.getItem("token");
    setCurrThreadId(id);

    try {
      const response = await fetch(`/api/thread/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const res = await response.json();
      if (response.ok) {
        setPrevChats(res);
        setNewChat(false);
        setReply(null);
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
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setAllThreads(prev => prev.filter(t => t.threadId !== id));
        if (id === currThreadId) createNewChat();
        toast.success("Deleted");
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <section className="sidebar">
      <div className="sidebar-header">
        <div className="nav-top">
          <img src={logoImg} alt="ForgeChat Logo" className="nav-logo-large" />
          <i className="fa-regular fa-pen-to-square new-icon" onClick={createNewChat} title="New Chat"></i>
        </div>
        
        <div className="menu-item-new" onClick={createNewChat}>
          <div className="plus-icon-circle">
             <i className="fa-solid fa-plus"></i>
          </div>
          <span>New chat</span>
        </div>
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
              <span className="title-text">
                {thread.title || "Untitled Chat"}
              </span>
              <div className="thread-actions">
                <i
                  className="fa-solid fa-trash-can"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteThread(thread.threadId);
                  }}
                ></i>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-footer">
        <div className="made-by-signature">
          Made with <span className="heart-red">❤️</span> by Suraj
        </div>
      </div>
    </section>
  );
}

export default Sidebar;