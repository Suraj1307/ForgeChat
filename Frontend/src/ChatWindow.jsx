import "./ChatWindow.css";
import { lazy, Suspense, useContext, useEffect, useRef, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import { ScaleLoader } from "react-spinners";
import toast from "react-hot-toast";

const Chat = lazy(() => import("./Chat.jsx"));

const SUGGESTED_PROMPTS = [
  "Explain this bug and suggest a fix",
  "Write a clean C++ prime factor program",
  "Summarize this article into bullet points",
  "Help me prepare for my next coding interview",
];

const TEXT_FILE_TYPES = [
  ".txt",
  ".md",
  ".json",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".html",
  ".py",
  ".java",
  ".cpp",
  ".c",
  ".csv",
];

const BINARY_FILE_TYPES = [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp"];
const ALL_FILE_TYPES = [...TEXT_FILE_TYPES, ...BINARY_FILE_TYPES];

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to read file"));
        return;
      }
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const inferTextLanguage = (fileName = "") => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const languageMap = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    cpp: "cpp",
    c: "c",
    java: "java",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
    csv: "csv",
    txt: "text",
  };

  return languageMap[ext] || "text";
};

const buildAttachmentFromFile = async (file) => {
  const lowerName = file.name.toLowerCase();

  if (TEXT_FILE_TYPES.some((ext) => lowerName.endsWith(ext))) {
    if (file.size > 120000) {
      throw new Error("Keep text or code attachments under 120 KB.");
    }

    return {
      kind: "text",
      name: file.name,
      mimeType: file.type || "text/plain",
      textContent: await file.text(),
      size: file.size,
      language: inferTextLanguage(file.name),
    };
  }

  const dataUrl = await fileToBase64(file);
  const fileData = dataUrl.split(",")[1] || "";

  if (lowerName.endsWith(".pdf")) {
    if (file.size > 1500000) {
      throw new Error("Keep PDF files under 1.5 MB.");
    }

    return {
      kind: "pdf",
      name: file.name,
      mimeType: file.type || "application/pdf",
      fileData,
      size: file.size,
    };
  }

  if (lowerName.endsWith(".docx")) {
    if (file.size > 1000000) {
      throw new Error("Keep DOCX files under 1 MB.");
    }

    return {
      kind: "docx",
      name: file.name,
      mimeType:
        file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileData,
      size: file.size,
    };
  }

  if ([".png", ".jpg", ".jpeg", ".webp"].some((ext) => lowerName.endsWith(ext))) {
    if (file.size > 1500000) {
      throw new Error("Keep image files under 1.5 MB.");
    }

    return {
      kind: "image",
      name: file.name,
      mimeType: file.type || "image/jpeg",
      previewUrl: dataUrl,
      size: file.size,
    };
  }

  throw new Error("Unsupported file type.");
};

const readSseStream = async (stream, onEvent) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const eventChunk of events) {
      const lines = eventChunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""));

      if (!lines.length) continue;

      const payload = JSON.parse(lines.join("\n"));
      onEvent(payload);
    }
  }
};

function ChatWindow() {
  const {
    prompt,
    setPrompt,
    setReply,
    streamReply,
    setStreamReply,
    currThreadId,
    setPrevChats,
    setNewChat,
    isSidebarOpen,
    setIsSidebarOpen,
    attachedFile,
    setAttachedFile,
  } = useContext(MyContext);

  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [uploadState, setUploadState] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [composerError, setComposerError] = useState("");
  const profileRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [prompt]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!profileRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  const clearAttachment = () => {
    setAttachedFile(null);
    setUploadState("idle");
    setStatusMessage("");
    setComposerError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isSupported = ALL_FILE_TYPES.some((ext) => lowerName.endsWith(ext));

    if (!isSupported) {
      const message = "Upload text, code, PDF, DOCX, PNG, JPG, JPEG, or WEBP files.";
      setComposerError(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    try {
      setUploadState("reading");
      setStatusMessage("Preparing attachment...");
      setComposerError("");
      const nextAttachment = await buildAttachmentFromFile(file);
      setAttachedFile(nextAttachment);
      setUploadState("ready");
      setStatusMessage("Attachment ready");
      toast.success(`${file.name} attached`);
    } catch (error) {
      const message = error.message || "Unable to attach this file.";
      setUploadState("error");
      setStatusMessage("");
      setComposerError(message);
      toast.error(message);
      event.target.value = "";
    }
  };

  const getReply = async () => {
    if (!prompt.trim() || loading || uploadState === "reading") return;

    const userMsg = prompt.trim();
    const attachmentPayload = attachedFile
      ? {
          kind: attachedFile.kind,
          name: attachedFile.name,
          mimeType: attachedFile.mimeType,
          textContent: attachedFile.textContent || "",
          fileData: attachedFile.fileData || "",
          previewUrl: attachedFile.previewUrl || "",
          size: attachedFile.size,
        }
      : null;

    setPrompt("");
    setLoading(true);
    setNewChat(false);
    setStreamReply("");
    setReply(null);
    setComposerError("");
    setStatusMessage(attachedFile ? "Uploading attachment..." : "Connecting...");
    setUploadState(attachedFile ? "sending" : "idle");

    setPrevChats((prev) => [
      ...prev,
      {
        role: "user",
        content: userMsg,
        attachments: attachedFile ? [attachedFile] : [],
      },
    ]);

    const token = localStorage.getItem("token");

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMsg,
          threadId: currThreadId,
          attachment: attachmentPayload,
        }),
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to start streaming response.");
      }

      let finalReply = "";

      await readSseStream(response.body, (event) => {
        if (event.type === "status") {
          setStatusMessage(event.status);
        }

        if (event.type === "delta") {
          finalReply += event.delta;
          setStreamReply((prev) => prev + event.delta);
        }

        if (event.type === "done") {
          const completedReply = event.reply || finalReply;
          setPrevChats((prev) => [...prev, { role: "assistant", content: completedReply }]);
          setStreamReply("");
          clearAttachment();
          setStatusMessage("");
          setUploadState("idle");
        }

        if (event.type === "error") {
          throw new Error(event.message || "Streaming failed.");
        }
      });
    } catch (err) {
      console.error(err);
      const message = err.message || "Something went wrong";
      setComposerError(message);
      setStatusMessage("");
      setUploadState(attachedFile ? "ready" : "idle");
      setStreamReply("");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileClick = () => {
    setIsOpen((prev) => !prev);
  };

  const handleLogout = () => {
    localStorage.clear();
    toast.success("Logged out");
    window.location.href = "/login";
  };

  const handleComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      getReply();
    }
  };

  const attachmentIcon =
    attachedFile?.kind === "image"
      ? "fa-image"
      : attachedFile?.kind === "pdf"
        ? "fa-file-pdf"
        : attachedFile?.kind === "docx"
          ? "fa-file-word"
          : "fa-file-lines";

  return (
    <div className="chatWindow" data-theme="dark">
      <div className="navbar">
        <div className="navbarLeft">
          <button
            type="button"
            className="mobileMenuButton"
            aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((prev) => !prev)}
          >
            <i className={`fa-solid ${isSidebarOpen ? "fa-xmark" : "fa-bars"}`}></i>
          </button>
          <span>ForgeChat</span>
        </div>

        <div
          className="userIconDiv"
          ref={profileRef}
          onClick={handleProfileClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleProfileClick();
            }
          }}
        >
          <span className="userIcon">
            <i className="fa-solid fa-user"></i>
          </span>

          {isOpen && (
            <div className="dropDown">
              <div className="dropDownHeader">
                <i className="fa-solid fa-user"></i>
                <div>
                  <p className="userName">{user?.name || "User"}</p>
                  <p className="userEmail">{user?.email || "No email"}</p>
                </div>
              </div>

              <button type="button" className="dropDownItem logout" onClick={handleLogout}>
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      <Suspense fallback={<div className="chatLoaderState">Loading chat...</div>}>
        <Chat suggestedPrompts={SUGGESTED_PROMPTS} />
      </Suspense>

      <div className="loaderDiv">
        <ScaleLoader color="#fff" loading={loading} height={20} />
      </div>

      <div className="chatInput">
        {attachedFile && (
          <div className={`attachmentPill ${uploadState === "error" ? "error" : ""}`}>
            <div className="attachmentMeta">
              <i className={`fa-solid ${attachmentIcon}`}></i>
              <span>{attachedFile.name}</span>
            </div>
            <button type="button" onClick={clearAttachment} aria-label="Remove attached file">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {composerError && (
          <div className="composerStatus error">
            <span>{composerError}</span>
          </div>
        )}

        <div className="inputBox">
          <textarea
            ref={textareaRef}
            placeholder="Ask anything..."
            value={prompt}
            rows={1}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleComposerKeyDown}
          />

          <div className="composerActions">
            <input
              ref={fileInputRef}
              type="file"
              className="fileInput"
              onChange={handleFileChange}
              accept={ALL_FILE_TYPES.join(",")}
            />
            <button
              type="button"
              className="composerActionButton"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              disabled={loading}
            >
              <i className="fa-solid fa-paperclip"></i>
            </button>
            <button
              type="button"
              id="submit"
              onClick={getReply}
              className={!prompt.trim() || loading || uploadState === "reading" ? "disabled" : ""}
              aria-label="Send message"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>

        <p className="info">
          Press Enter to send, Shift + Enter for a new line. Supports text/code files, PDF, DOCX, and common images.
        </p>
      </div>
    </div>
  );
}

export default ChatWindow;
