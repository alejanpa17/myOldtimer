function ChatMessageList({ chatLog, isSending, threadEndRef }) {
  const isVideoSourceAllowed = (video) => {
    const uri = `${video?.url || video?.sourceUrl || ""}`.toLowerCase();
    return (
      uri.includes("youtube.com/") ||
      uri.includes("youtu.be/") ||
      uri.includes("vertexaisearch.cloud.google.com/grounding-api-redirect/")
    );
  };

  const filterAllowedVideos = (videos) =>
    Array.isArray(videos) ? videos.filter((video) => video && isVideoSourceAllowed(video)) : [];

  const findVideoForSource = (source, videos) => {
    if (!source?.uri || !Array.isArray(videos)) {
      return null;
    }
    return (
      videos.find((video) => video?.sourceUrl && video.sourceUrl === source.uri) ||
      videos.find((video) => video?.url && video.url === source.uri) ||
      null
    );
  };

  const openGroundingUrl = (event, uri) => {
    if (!uri) {
      return;
    }
    event.preventDefault();
    const opened = window.open(uri, "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
    }
  };

  return (
    <section className="ai-chat-thread" aria-live="polite">
      {chatLog.map((message) => (
        <article key={message.id}>
          {(() => {
            const videosInSources = filterAllowedVideos(message.videos);
            const hasSourcesBlock =
              message.role === "ai" &&
              (videosInSources.length > 0 ||
                (Array.isArray(message.sources) && message.sources.length > 0));

            return (
          <div
            className={`chat-bubble ${
              message.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
            }`}
          >
            {message.text}
            {hasSourcesBlock && (
                <div className="chat-sources">
                  <p className="chat-sources-title">Sources</p>
                  {videosInSources.length > 0 && (
                    <div
                      className="chat-videos-row"
                      role="group"
                      aria-label="Related YouTube videos"
                    >
                      {videosInSources.map((video, index) => {
                        const targetUrl = video.url || video.sourceUrl;
                        const keyPart = video.videoId || targetUrl || String(index);
                        return (
                          <a
                            key={`${message.id}-video-${keyPart}`}
                            className="chat-video-link"
                            href={targetUrl || "#"}
                            target="_blank"
                            rel="noreferrer"
                            title={video.title}
                            onClick={(event) => openGroundingUrl(event, targetUrl)}
                          >
                            <div className="chat-video-media">
                              {video.thumbnailSrc || video.thumbnailUrl ? (
                                <img
                                  className="chat-video-thumb"
                                  src={video.thumbnailSrc || video.thumbnailUrl}
                                  alt={video.title}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="chat-video-thumb-placeholder">{video.title}</div>
                              )}
                              {video.loading && (
                                <span className="chat-video-spinner" aria-hidden />
                              )}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                  {Array.isArray(message.sources) &&
                    message.sources.map((source, index) => {
                      const linkedVideo = findVideoForSource(source, videosInSources);
                      const href = source.uri;
                      const title = linkedVideo?.title || source.title;
                      return (
                        <a
                          key={`${message.id}-source-${source.uri}`}
                          className="chat-source-link"
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {index + 1}. {title}
                        </a>
                      );
                    })}
                </div>
              )}
          </div>
            );
          })()}
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
