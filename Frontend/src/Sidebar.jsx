import "./Sidebar.css";
import { useContext, useEffect } from "react";
import { MyContext } from "./MyContext.jsx";
import { v1 as uuidv1 } from "uuid";
import toast from "react-hot-toast";


const logo = new URL("./assets/blacklogo.png", import.meta.url).href;

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
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const res = await response.json();
      if (!response.ok || !Array.isArray(res)) return;

      setAllThreads(
        res.map(thread => ({
          threadId: thread.threadId,
          title: thread.title
        }))
      );
    } catch {
      toast.error("Failed to load chat history");
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

  const changeThread = async (newThreadId) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setCurrThreadId(newThreadId);

    try {
      const response = await fetch(`/api/thread/${newThreadId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const res = await response.json();
      if (!response.ok) return toast.error("Failed to open chat");

      setPrevChats(res);
      setNewChat(false);
      setReply(null);
    } catch {
      toast.error("Server error");
    }
  };

  const deleteThread = async (threadId) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`/api/thread/${threadId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) return toast.error("Delete failed");

      setAllThreads(prev =>
        prev.filter(thread => thread.threadId !== threadId)
      );

      if (threadId === currThreadId) createNewChat();
      toast.success("Chat deleted");
    } catch {
      toast.error("Server error");
    }
  };

  return (
    <section className="sidebar">
      <button onClick={createNewChat}>
        <img
          src={logo}
          alt="ForgeChat logo"
          className="logo"
        />
        <span>
          <i className="fa-solid fa-pen-to-square"></i>
        </span>
      </button>

      <ul className="history">
        {allThreads?.map(thread => (
          <li
            key={thread.threadId}
            onClick={() => changeThread(thread.threadId)}
            className={
              thread.threadId === currThreadId ? "highlighted" : ""
            }
          >
            {thread.title}
            <i
              className="fa-solid fa-trash"
              onClick={(e) => {
                e.stopPropagation();
                deleteThread(thread.threadId);
              }}
            ></i>
          </li>
        ))}
      </ul>

      <div className="sign">
        <p>By Suraj ♥</p>
      </div>
    </section>
  );
}

export default Sidebar;
