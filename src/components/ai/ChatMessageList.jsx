function ChatMessageList({ chatLog, isSending, threadEndRef }) {
  const splitMarkdownBlocks = (text) => {
    const lines = String(text || "").split(/\r?\n/);
    const blocks = [];
    let inCode = false;
    let paragraphLines = [];
    let codeLines = [];

    const flushParagraph = () => {
      if (paragraphLines.length === 0) {
        return;
      }
      blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
      paragraphLines = [];
    };

    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        if (inCode) {
          blocks.push({ type: "code", text: codeLines.join("\n") });
          codeLines = [];
          inCode = false;
        } else {
          flushParagraph();
          inCode = true;
        }
        continue;
      }

      if (inCode) {
        codeLines.push(line);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        continue;
      }

      paragraphLines.push(line);
    }

    if (inCode) {
      blocks.push({ type: "code", text: codeLines.join("\n") });
    } else {
      flushParagraph();
    }

    return blocks;
  };

  const renderInlineMarkdown = (text, keyPrefix) => {
    const segments = String(text || "").split(/(`[^`]+`)/g);
    const rendered = [];

    segments.forEach((segment, index) => {
      if (segment.startsWith("`") && segment.endsWith("`") && segment.length >= 2) {
        rendered.push(
          <code className="chat-inline-code" key={`${keyPrefix}-code-${index}`}>
            {segment.slice(1, -1)}
          </code>
        );
        return;
      }

      const linkParts = segment.split(/(\[[^\]]+\]\([^)]+\))/g);
      linkParts.forEach((linkPart, linkIndex) => {
        const linkMatch = linkPart.match(/^\[([^\]]+)\]\([^)]+\)$/);
        if (linkMatch) {
          rendered.push(
            <span className="chat-link-text" key={`${keyPrefix}-link-${index}-${linkIndex}`}>
              {linkMatch[1]}
            </span>
          );
          return;
        }

        const boldParts = linkPart.split(/(\*\*[^*]+\*\*)/g);
        boldParts.forEach((boldPart, boldIndex) => {
          if (boldPart.startsWith("**") && boldPart.endsWith("**") && boldPart.length >= 4) {
            rendered.push(
              <strong key={`${keyPrefix}-bold-${index}-${linkIndex}-${boldIndex}`}>
                {boldPart.slice(2, -2)}
              </strong>
            );
            return;
          }

          const italicParts = boldPart.split(/(\*[^*]+\*)/g);
          italicParts.forEach((italicPart, italicIndex) => {
            if (italicPart.startsWith("*") && italicPart.endsWith("*") && italicPart.length >= 2) {
              rendered.push(
                <em key={`${keyPrefix}-em-${index}-${linkIndex}-${boldIndex}-${italicIndex}`}>
                  {italicPart.slice(1, -1)}
                </em>
              );
              return;
            }
            if (italicPart) {
              rendered.push(
                <span key={`${keyPrefix}-text-${index}-${linkIndex}-${boldIndex}-${italicIndex}`}>
                  {italicPart}
                </span>
              );
            }
          });
        });
      });
    });

    return rendered;
  };

  const renderMarkdownText = (text, keyPrefix) => {
    const blocks = splitMarkdownBlocks(text);
    if (blocks.length === 0) {
      return null;
    }

    return (
      <div className="chat-markdown">
        {blocks.map((block, index) => {
          const blockKey = `${keyPrefix}-block-${index}`;
          if (block.type === "code") {
            return (
              <pre className="chat-code-block" key={blockKey}>
                <code>{block.text}</code>
              </pre>
            );
          }

          const lines = block.text.split("\n");
          return (
            <p className="chat-paragraph" key={blockKey}>
              {lines.map((line, lineIndex) => (
                <span key={`${blockKey}-line-${lineIndex}`}>
                  {renderInlineMarkdown(line, `${blockKey}-line-${lineIndex}`)}
                  {lineIndex < lines.length - 1 && <br />}
                </span>
              ))}
            </p>
          );
        })}
      </div>
    );
  };

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
            {renderMarkdownText(message.text, message.id)}
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
