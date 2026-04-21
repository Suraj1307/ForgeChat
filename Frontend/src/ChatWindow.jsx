import "./ChatWindow.css";
import { lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { v1 as uuidv1 } from "uuid";
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
  let eventDataLines = [];

  const flushEvent = () => {
    if (!eventDataLines.length) return;

    const payload = eventDataLines.join("\n").trim();
    eventDataLines = [];

    if (!payload || payload === "[DONE]") return;

    onEvent(JSON.parse(payload));
  };

  while (true) {
    const { value, done } = await reader.read();

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line) {
        flushEvent();
        continue;
      }

      if (line.startsWith("data:")) {
        eventDataLines.push(line.replace(/^data:\s?/, ""));
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer.startsWith("data:")) {
    eventDataLines.push(buffer.replace(/^data:\s?/, ""));
  }
  flushEvent();
};

const getUserInitials = (name = "", email = "") => {
  const trimmedName = String(name || "").trim();

  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : parts[0]?.[1] || "";
    return `${first}${last}`.trim().toUpperCase() || "U";
  }

  const fallback = String(email || "").trim();
  return (fallback.slice(0, 2) || "U").toUpperCase();
};

const formatJoinedDate = (value) => {
  if (!value) return "Recently joined";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently joined";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

function ChatWindow() {
  const {
    prompt,
    setPrompt,
    setReply,
    setStreamReply,
    currThreadId,
    newChat,
    setPrevChats,
    setNewChat,
    isSidebarOpen,
    setIsSidebarOpen,
    attachedFile,
    setAttachedFile,
    authUser,
    authToken,
    logout,
    bumpThreadsRevision,
    setCancelActiveStream,
  } = useContext(MyContext);

  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [uploadState, setUploadState] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [composerError, setComposerError] = useState("");
  const profileRef = useRef(null);
  const profileModalRef = useRef(null);
  const profileCloseButtonRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamControllerRef = useRef(null);
  const activeRequestIdRef = useRef(0);
  const pendingMessageIdRef = useRef(null);

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

  useEffect(() => {
    if (!isOpen) return undefined;

    profileCloseButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = profileModalRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements?.length) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const cancelActiveRequest = useCallback(() => {
    activeRequestIdRef.current += 1;
    pendingMessageIdRef.current = null;
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
    setLoading(false);
    setStreamReply("");
    setStatusMessage("");
    setUploadState((prev) => (attachedFile && prev !== "reading" ? "ready" : "idle"));
  }, [attachedFile, setStreamReply]);

  useEffect(() => {
    setCancelActiveStream(() => cancelActiveRequest);

    return () => {
      setCancelActiveStream(() => () => {});
      streamControllerRef.current?.abort();
    };
  }, [cancelActiveRequest, setCancelActiveStream]);

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
    const requestId = activeRequestIdRef.current + 1;
    const pendingMessageId = uuidv1();
    const nextAttachment = attachedFile;
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

    activeRequestIdRef.current = requestId;
    pendingMessageIdRef.current = pendingMessageId;
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
        id: pendingMessageId,
        role: "user",
        content: userMsg,
        attachments: nextAttachment ? [nextAttachment] : [],
        status: "pending",
      },
    ]);

    let firstEventTimeout = null;

    try {
      const controller = new AbortController();
      streamControllerRef.current = controller;
      let hasReceivedStreamEvent = false;

      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: userMsg,
          threadId: currThreadId,
          attachment: attachmentPayload,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        if (response.status === 401) {
          logout();
          throw new Error("Session expired. Please log in again.");
        }

        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to start streaming response.");
      }

      firstEventTimeout = window.setTimeout(() => {
        if (!hasReceivedStreamEvent && !controller.signal.aborted) {
          controller.abort();
        }
      }, 20000);

      let finalReply = "";

      await readSseStream(response.body, (event) => {
        if (activeRequestIdRef.current !== requestId) return;
        hasReceivedStreamEvent = true;
        if (firstEventTimeout) {
          window.clearTimeout(firstEventTimeout);
          firstEventTimeout = null;
        }

        if (event.type === "status") {
          setStatusMessage(event.status);
        }

        if (event.type === "delta") {
          finalReply += event.delta;
          setStreamReply((prev) => prev + event.delta);
        }

        if (event.type === "done") {
          const completedReply = event.reply || finalReply;
          streamControllerRef.current = null;
          pendingMessageIdRef.current = null;
          setPrevChats((prev) => [
            ...prev.map((chat) =>
              chat.id === pendingMessageId ? { ...chat, status: "sent" } : chat
            ),
            { id: uuidv1(), role: "assistant", content: completedReply },
          ]);
          setStreamReply("");
          clearAttachment();
          setStatusMessage("");
          setUploadState("idle");
          bumpThreadsRevision();
        }

        if (event.type === "error") {
          throw new Error(event.message || "Streaming failed.");
        }
      });
    } catch (err) {
      console.error(err);
      streamControllerRef.current = null;
      const isAbort = err.name === "AbortError";
      if (isAbort || activeRequestIdRef.current !== requestId) {
        if (activeRequestIdRef.current === requestId) {
          const message =
            "The server connected but did not start streaming. Check whether the backend and OpenAI request are working.";
          setComposerError("");
          setStatusMessage("");
          setUploadState(nextAttachment ? "ready" : "idle");
          setStreamReply("");
          setPrevChats((prev) =>
            prev.map((chat) =>
              chat.id === pendingMessageId ? { ...chat, status: "failed", error: message } : chat
            )
          );
          toast.error(message);
        }
        return;
      }

      const message =
        err instanceof TypeError && /fetch/i.test(err.message || "")
          ? "Cannot reach the backend server. Make sure the API is running on port 5000."
          : err.message || "Something went wrong";
      setComposerError("");
      setStatusMessage("");
      setUploadState(nextAttachment ? "ready" : "idle");
      setStreamReply("");

      setPrevChats((prev) =>
        prev.map((chat) =>
          chat.id === pendingMessageId ? { ...chat, status: "failed", error: message } : chat
        )
      );

      toast.error(message);
    } finally {
      if (typeof firstEventTimeout === "number") {
        window.clearTimeout(firstEventTimeout);
      }
      if (activeRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const handleProfileClick = () => {
    setIsOpen((prev) => !prev);
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(authUser?.email || "");
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy email");
    }
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
  const userInitials = getUserInitials(authUser?.name, authUser?.email);
  const joinedLabel = formatJoinedDate(authUser?.createdAt);
  const firstName = authUser?.name?.trim()?.split(/\s+/)?.[0] || "there";

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
          <div className="navbarBrand">
            <span>ForgeChat</span>
          </div>
        </div>

        <div className="userIconDiv" ref={profileRef}>
          <button
            type="button"
            className="userIconButton"
            onClick={handleProfileClick}
            aria-label="Open profile"
            aria-expanded={isOpen}
          >
          <span className="userIcon">
            {authUser?.avatarUrl ? (
              <img src={authUser.avatarUrl} alt={`${authUser.name || "User"} avatar`} className="userAvatarImage" />
            ) : (
              <span className="userInitials">{userInitials}</span>
            )}
          </span>
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          <button
            type="button"
            className="profileModalBackdrop"
            aria-label="Close profile"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="profileModal"
            role="dialog"
            aria-modal="true"
            aria-label="Profile details"
            ref={profileModalRef}
          >
            <button
              type="button"
              className="profileModalClose"
              ref={profileCloseButtonRef}
              onClick={() => setIsOpen(false)}
              aria-label="Close profile"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="profileModalAvatar">
              {authUser?.avatarUrl ? (
                <img
                  src={authUser.avatarUrl}
                  alt={`${authUser.name || "User"} avatar`}
                  className="dropDownAvatarImage"
                />
              ) : (
                <span className="dropDownAvatarInitials">{userInitials}</span>
              )}
            </div>

            <div className="profileModalBody">
              <p className="profileModalEyebrow">ForgeChat Profile</p>
              <h2 className="profileModalName">{authUser?.name || "User"}</h2>
              <p className="profileModalEmail">{authUser?.email || "No email"}</p>
              <p className="profileModalMeta">Joined {joinedLabel}</p>
            </div>

            <div className="profileModalActions">
              <button type="button" className="profileSecondaryButton" onClick={handleCopyEmail}>
                <i className="fa-regular fa-copy"></i>
                Copy email
              </button>
            </div>
          </div>
        </>
      )}

      <div className="chatStage">
        <Suspense fallback={<div className="chatLoaderState">Loading chat...</div>}>
          <Chat suggestedPrompts={SUGGESTED_PROMPTS} />
        </Suspense>
      </div>

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
            placeholder="Ask anything, or drop in code, docs, and screenshots..."
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

        {statusMessage && statusMessage !== "Thinking..." && <p className="info">{statusMessage}</p>}
      </div>
    </div>
  );
}

export default ChatWindow;
