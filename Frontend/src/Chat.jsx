import "./Chat.css";
import React, { useContext, useEffect, useRef } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";
import toast from "react-hot-toast";

const getChatKey = (chat, idx) => {
  if (chat.id) return chat.id;
  if (chat._id) return chat._id;
  return `${chat.role || "message"}-${idx}-${String(chat.content || "").slice(0, 24)}`;
};

const downloadAttachment = (attachment) => {
  const triggerDownload = (href, fileName) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (attachment.previewUrl) {
    triggerDownload(attachment.previewUrl, attachment.name);
    return;
  }

  if (attachment.fileData) {
    triggerDownload(`data:${attachment.mimeType};base64,${attachment.fileData}`, attachment.name);
    return;
  }

  if (attachment.textContent) {
    const blob = new Blob([attachment.textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, attachment.name);
    URL.revokeObjectURL(url);
    return;
  }

  toast.error("Original file data is not stored for this attachment.");
};

const downloadTextFile = (fileName, content) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function Chat({ suggestedPrompts = [] }) {
  const { newChat, prevChats, streamReply, setPrompt } = useContext(MyContext);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [prevChats, streamReply]);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!", {
        style: { background: "#333", color: "#fff", fontSize: "12px" },
      });
    } catch {
      toast.error("Clipboard access is unavailable in this browser.");
    }
  };

  const MarkdownComponents = {
    pre: ({ children }) => {
      const codeValue = children?.props?.children || "";
      const className = children?.props?.className || "";
      const lang = className.replace("language-", "") || "code";

      return (
        <div className="code-block-wrapper">
          <div className="code-header">
            <span className="code-lang">{lang}</span>
            <div className="code-actions">
              <button className="code-copy-btn" onClick={() => handleCopy(codeValue)}>
                <i className="fa-regular fa-copy"></i>
                <span>Copy code</span>
              </button>
              <button
                className="code-copy-btn"
                onClick={() => downloadTextFile(`snippet.${lang === "code" ? "txt" : lang}`, codeValue)}
              >
                <i className="fa-solid fa-download"></i>
                <span>Download</span>
              </button>
            </div>
          </div>
          <pre className={className}>{children}</pre>
        </div>
      );
    },
    table: ({ children }) => (
      <div className="table-wrapper">
        <table>{children}</table>
      </div>
    ),
    input: ({ checked, disabled, ...props }) => (
      <input {...props} checked={checked} disabled={disabled} readOnly className="markdown-checkbox" />
    ),
  };

  return (
    <div className="chats">
      {newChat && (
        <div className="welcome-screen">
          <h1>What can I help with?</h1>
          <p className="welcome-copy">
            Start with a question, paste some code, or use one of these prompts to get moving faster.
          </p>
          <div className="suggested-prompts">
            {suggestedPrompts.map((item) => (
              <button key={item} type="button" className="prompt-chip" onClick={() => setPrompt(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {prevChats?.map((chat, idx) => (
        <div key={getChatKey(chat, idx)} className={chat.role === "user" ? "userDiv" : "gptDiv"}>
          <div className={chat.role === "user" ? "userMessage" : "gptMessage"}>
            <ReactMarkdown
              components={MarkdownComponents}
              rehypePlugins={[rehypeHighlight]}
              remarkPlugins={[remarkGfm]}
            >
              {chat.content}
            </ReactMarkdown>

            {chat.attachments?.length > 0 && (
              <div className="message-attachments">
                {chat.attachments.map((attachment, attachmentIdx) =>
                  attachment.kind === "image" && attachment.previewUrl ? (
                    <button
                      key={`${attachment.name}-${attachmentIdx}`}
                      type="button"
                      className="image-attachment"
                      onClick={() => downloadAttachment(attachment)}
                    >
                      <img src={attachment.previewUrl} alt={attachment.name} />
                      <span>{attachment.name}</span>
                    </button>
                  ) : (
                    <button
                      key={`${attachment.name}-${attachmentIdx}`}
                      type="button"
                      className="attachment-card"
                      onClick={() => downloadAttachment(attachment)}
                    >
                      <i
                        className={`fa-solid ${
                          attachment.kind === "pdf"
                            ? "fa-file-pdf"
                            : attachment.kind === "docx"
                              ? "fa-file-word"
                              : "fa-file-lines"
                        }`}
                      ></i>
                      <span>{attachment.name}</span>
                    </button>
                  )
                )}
              </div>
            )}

            {chat.role === "user" && chat.status === "failed" && (
              <div className="composerStatus error">
                <span>{chat.error || "Message failed to send."}</span>
                <button type="button" className="code-copy-btn" onClick={() => setPrompt(chat.content)}>
                  Retry
                </button>
              </div>
            )}

            {chat.role === "assistant" && (
              <button
                type="button"
                className="copy-btn"
                onClick={() => handleCopy(chat.content)}
                title="Copy message"
                aria-label="Copy message"
              >
                <i className="fa-regular fa-copy"></i>
                <span>Copy</span>
              </button>
            )}
          </div>
        </div>
      ))}

      {streamReply && (
        <div className="gptDiv">
          <div className="gptMessage streaming-message">
            <ReactMarkdown
              components={MarkdownComponents}
              rehypePlugins={[rehypeHighlight]}
              remarkPlugins={[remarkGfm]}
            >
              {streamReply}
            </ReactMarkdown>
            <div className="streaming-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
      <div ref={scrollRef} style={{ height: "120px" }} />
    </div>
  );
}

export default Chat;
