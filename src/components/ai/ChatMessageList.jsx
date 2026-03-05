function ChatMessageList({ chatLog, isSending, threadEndRef }) {
  return (
    <section className="ai-chat-thread" aria-live="polite">
      {chatLog.map((message) => (
        <article key={message.id}>
          <div
            className={`chat-bubble ${
              message.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
            }`}
          >
            {message.text}
            {message.role === "ai" &&
              Array.isArray(message.sources) &&
              message.sources.length > 0 && (
                <div className="chat-sources">
                  <p className="chat-sources-title">Sources</p>
                  {message.sources.map((source, index) => (
                    <a
                      key={`${message.id}-source-${source.uri}`}
                      className="chat-source-link"
                      href={source.uri}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {index + 1}. {source.title}
                    </a>
                  ))}
                </div>
              )}
          </div>
        </article>
      ))}
      {isSending && (
        <article className="chat-bubble chat-bubble-ai chat-bubble-typing">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </article>
      )}
      <div ref={threadEndRef} />
    </section>
  );
}

export default ChatMessageList;
