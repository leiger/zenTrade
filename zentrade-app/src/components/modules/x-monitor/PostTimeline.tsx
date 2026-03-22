'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { ArrowUp, Loader2, MessageCircle, Repeat2, Heart, ExternalLink } from 'lucide-react';
import { fetchPostHistory, type HistoricalPost } from '@/lib/xmonitor-api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PostTimelineProps {
  startDate?: string;
  endDate?: string;
}

export function PostTimeline({ startDate, endDate }: PostTimelineProps) {
  const [posts, setPosts] = useState<HistoricalPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [showTopBtn, setShowTopBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const limit = 20;

  const loadPosts = useCallback(
    async (isReset = false) => {
      if (loading || (!hasMore && !isReset)) return;

      setLoading(true);
      try {
        const currentOffset = isReset ? 0 : offset;
        const data = await fetchPostHistory(limit, currentOffset, startDate, endDate);

        if (isReset) {
          setPosts(data);
        } else {
          setPosts((prev) => [...prev, ...data]);
        }

        setOffset(currentOffset + data.length);
        setHasMore(data.length === limit);
      } catch (e) {
        console.error('Failed to load post history', e);
      } finally {
        setLoading(false);
      }
    },
    [loading, hasMore, offset, startDate, endDate]
  );

  useEffect(() => {
    setHasMore(true);
    loadPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;

    setShowTopBtn(scrollTop > 400);

    if (scrollHeight - scrollTop - clientHeight < 150) {
      if (!loading && hasMore) {
        loadPosts();
      }
    }
  }, [loading, hasMore, loadPosts]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getUrlParams = (postId: string) => `https://x.com/elonmusk/status/${postId}`;

  return (
    <div className="flex flex-col h-[700px] w-full relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 pb-4">
        {posts.map((post, index) => {
          const metrics = post.metrics || {};
          const likeCount = metrics.likeCount || metrics.favorites || 0;
          const rtCount = metrics.rtCount || metrics.retweets || 0;
          const replyCount = metrics.replyCount || metrics.replies || 0;

          return (
            <div key={post.id} className="relative pl-6 pb-6">
              {/* Timeline line */}
              {index !== posts.length - 1 ? (
                <div className="absolute left-[11px] top-[32px] bottom-[-22px] w-[2px] bg-border z-0" />
              ) : hasMore ? (
                <div className="absolute left-[11px] top-[32px] bottom-0 w-[2px] bg-border z-0" />
              ) : null}

              {/* Timeline dot */}
              <div className="absolute left-[7px] top-[22px] w-[10px] h-[10px] rounded-full bg-primary/20 border-2 border-primary z-10" />

              <div className="border rounded-lg p-3 bg-muted/10 hover:bg-muted/30 transition-colors relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground/80">elonmusk</span>
                  <a
                    href={getUrlParams(post.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    {format(new Date(post.createdAt), 'MMM d, HH:mm')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                  {post.content}
                </p>

                {Object.keys(metrics).length > 0 && (
                  <div className="mt-3 flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="text-[10px] tabular-nums">{replyCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Repeat2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] tabular-nums">{rtCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" />
                      <span className="text-[10px] tabular-nums">{likeCount}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && !hasMore && posts.length > 0 && (
          <div className="text-center p-4 text-xs text-muted-foreground">No more posts</div>
        )}

        {!loading && posts.length === 0 && (
          <div className="text-center p-8 text-sm text-muted-foreground flex flex-col items-center gap-2">
            No posts found in this time window
          </div>
        )}
      </div>

      {showTopBtn && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="absolute bottom-6 right-6 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-10 flex items-center justify-center transition-all animate-in fade-in zoom-in"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
