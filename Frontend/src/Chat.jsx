import "./Chat.css";
import React, { useContext, useState, useEffect, useRef } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import toast from "react-hot-toast";

function Chat() {
  const { newChat, prevChats, reply } = useContext(MyContext);
  const [latestReply, setLatestReply] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [prevChats, latestReply]);

  useEffect(() => {
    if (reply === null) {
      setLatestReply(null);
      return;
    }
    const content = reply.split(" ");
    let idx = 0;
    const interval = setInterval(() => {
      setLatestReply(content.slice(0, idx + 1).join(" "));
      idx++;
      if (idx >= content.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [reply]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!", {
      style: { background: "#333", color: "#fff", fontSize: "12px" },
    });
  };

  // --- NEW: Markdown Component Overrides ---
  const MarkdownComponents = {
    pre: ({ children }) => {
      // Extract the code string from the code element inside pre
      const codeValue = children?.props?.children || "";
      // Extract language if available (e.g., "language-javascript")
      const className = children?.props?.className || "";
      const lang = className.replace("language-", "") || "code";

      return (
        <div className="code-block-wrapper">
          <div className="code-header">
            <span className="code-lang">{lang}</span>
            <button 
              className="code-copy-btn" 
              onClick={() => handleCopy(codeValue)}
            >
              <i className="fa-regular fa-copy"></i>
              <span>Copy code</span>
            </button>
          </div>
          <pre className={className}>
            {children}
          </pre>
        </div>
      );
    }
  };

  return (
    <div className="chats">
      {newChat && (
        <div className="welcome-screen">
          <h1>What can I help with?</h1>
        </div>
      )}
      
      {prevChats?.map((chat, idx) => (
        <div key={idx} className={chat.role === "user" ? "userDiv" : "gptDiv"}>
          <div className={chat.role === "user" ? "userMessage" : "gptMessage"}>
            <ReactMarkdown 
              components={MarkdownComponents} 
              rehypePlugins={[rehypeHighlight]}
            >
              {chat.content}
            </ReactMarkdown>
            
            {chat.role === "assistant" && (
              <button className="copy-btn" onClick={() => handleCopy(chat.content)} title="Copy message">
                <i className="fa-regular fa-copy"></i>
              </button>
            )}
          </div>
        </div>
      ))}

      {latestReply && (
        <div className="gptDiv">
          <div className="gptMessage">
            <ReactMarkdown 
              components={MarkdownComponents} 
              rehypePlugins={[rehypeHighlight]}
            >
              {latestReply}
            </ReactMarkdown>
            <button className="copy-btn" onClick={() => handleCopy(latestReply)}>
              <i className="fa-regular fa-copy"></i>
            </button>
          </div>
        </div>
      )}
      <div ref={scrollRef} style={{ height: "120px" }} />
    </div>
  );
}

export default Chat;