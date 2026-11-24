import { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Volume2, VolumeX } from 'lucide-react';
import type { Media } from '@/shared/protocol';
import { cn } from '@/lib/utils';

const fill = 'size-full object-contain';

function Video({
  media,
  active,
  isClick,
}: {
  media: Extract<Media, { kind: 'video' }>;
  active: boolean;
  isClick: () => boolean;
}) {
  const [muted, setMuted] = useState(true);
  if (!active) return <img src={media.poster} alt="" draggable={false} className={fill} />;
  return (
    <>
      <video
        src={media.url}
        poster={media.poster}
        autoPlay
        loop
        playsInline
        muted={muted}
        className={fill}
        onClick={(event) => {
          if (!isClick()) return;
          const video = event.currentTarget;
          // First click turns the sound on; later clicks pause and resume.
          if (muted) setMuted(false);
          else if (video.paused) void video.play();
          else video.pause();
        }}
      />
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 p-1.5 text-white">
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </span>
    </>
  );
}

function YouTube({
  media,
  active,
  isClick,
}: {
  media: Extract<Media, { kind: 'youtube' }>;
  active: boolean;
  isClick: () => boolean;
}) {
  const [playing, setPlaying] = useState(false);
  if (playing && active)
    return (
      <iframe
        src={chrome.runtime.getURL(`src/player/index.html?v=${media.videoId}`)}
        title="Video"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        className="size-full"
      />
    );
  return (
    <button
      type="button"
      aria-label="Play"
      disabled={!active}
      onClick={() => isClick() && setPlaying(true)}
      className="group relative size-full"
    >
      <img src={media.poster} alt="" draggable={false} className="size-full object-cover" />
      <span className="absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full bg-black/60 text-white transition group-hover:bg-black/80">
        <Play className="size-6 fill-current" />
      </span>
      {media.duration && (
        <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
          {media.duration}
        </span>
      )}
      {media.progress > 0 && (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
          <span className="block h-full bg-brand" style={{ width: `${media.progress}%` }} />
        </span>
      )}
    </button>
  );
}

function Slide(props: { media: Media; active: boolean; isClick: () => boolean }) {
  const { media } = props;
  if (media.kind === 'image')
    return <img src={media.url} alt="" draggable={false} className={fill} />;
  if (media.kind === 'video') return <Video {...props} media={media} />;
  return <YouTube {...props} media={media} />;
}

/** The media of one card: a single photo or video, or a carousel. */
export function Gallery({
  media,
  active,
  isClick,
}: {
  media: Media[];
  active: boolean;
  isClick: () => boolean;
}) {
  const [index, setIndex] = useState(0);
  const step = (delta: number) => setIndex((i) => (i + delta + media.length) % media.length);
  const youtube = media[0].kind === 'youtube';

  return (
    <div className={cn('relative min-h-0 bg-black', youtube ? 'aspect-video shrink-0' : 'flex-1')}>
      <Slide key={index} media={media[index]} active={active} isClick={isClick} />
      {media.length > 1 && (
        <>
          {[
            { delta: -1, label: 'Previous', Icon: ChevronLeft, side: 'left-2' },
            { delta: 1, label: 'Next', Icon: ChevronRight, side: 'right-2' },
          ].map(({ delta, label, Icon, side }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={() => isClick() && step(delta)}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80',
                side,
              )}
            >
              <Icon className="size-5" />
            </button>
          ))}
          <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {media.map((_, i) => (
              <span
                key={i}
                className={cn('size-1.5 rounded-full', i === index ? 'bg-white' : 'bg-white/40')}
              />
            ))}
          </span>
        </>
      )}
    </div>
  );
}
