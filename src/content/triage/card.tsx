import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
  type PanInfo,
  type Variants,
} from 'motion/react';
import type { Item } from '@/shared/protocol';
import { cn } from '@/lib/utils';
import { Gallery } from './media';
import type { Verdict } from './state';

const DISTANCE = 120;
const SPEED = 600;

export function verdictFor({ offset, velocity }: PanInfo): Verdict | null {
  if (offset.y < -DISTANCE || velocity.y < -SPEED) return 'open';
  if (offset.x < -DISTANCE || velocity.x < -SPEED) return 'remove';
  if (offset.x > DISTANCE || velocity.x > SPEED) return 'keep';
  return null;
}

const variants: Variants = {
  stacked: (depth: number) => ({ scale: 1 - depth * 0.05, y: depth * 16, opacity: 1 }),
  exit: (verdict: Verdict | undefined) =>
    verdict === 'open'
      ? { y: -700, opacity: 0, transition: { duration: 0.3 } }
      : { x: verdict === 'remove' ? -700 : 700, opacity: 0, transition: { duration: 0.3 } },
};

function Stamp({
  label,
  className,
  opacity,
}: {
  label: string;
  className: string;
  opacity: MotionValue<number>;
}) {
  return (
    <motion.span
      style={{ opacity }}
      className={cn(
        'pointer-events-none absolute top-6 z-10 rounded-lg border-4 bg-card/80 px-3 py-1 text-2xl font-black tracking-wider uppercase',
        className,
      )}
    >
      {label}
    </motion.span>
  );
}

export function Card({
  item,
  depth,
  onDecide,
}: {
  item: Item;
  depth: number;
  onDecide: (verdict: Verdict) => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-15, 15]);
  const remove = useTransform(x, [-DISTANCE, -20], [1, 0]);
  const keep = useTransform(x, [20, DISTANCE], [0, 1]);
  const open = useTransform(y, [-DISTANCE, -20], [1, 0]);
  // A drag ends with a click on whatever is under the pointer; media ignores it.
  const dragged = useRef(false);
  const top = depth === 0;
  const hasMedia = item.media.length > 0;

  return (
    <motion.article
      custom={depth}
      variants={variants}
      initial={{ scale: 0.9, y: 32, opacity: 0 }}
      animate="stacked"
      exit="exit"
      style={{ x, y, rotate, zIndex: 10 - depth }}
      drag={top}
      dragSnapToOrigin
      dragElastic={0.9}
      onPointerDown={() => (dragged.current = false)}
      onDragStart={() => (dragged.current = true)}
      onDragEnd={(_, info) => {
        const verdict = verdictFor(info);
        if (verdict) onDecide(verdict);
      }}
      aria-hidden={!top}
      className={cn(
        'absolute inset-0 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl select-none',
        top ? 'cursor-grab touch-none active:cursor-grabbing' : 'pointer-events-none',
      )}
    >
      {hasMedia && (
        <Gallery key={item.id} media={item.media} active={top} isClick={() => !dragged.current} />
      )}
      <div
        className={cn(
          'space-y-2 overflow-y-auto p-4',
          hasMedia ? 'max-h-[40%] shrink-0' : 'flex-1 p-6',
        )}
      >
        {item.title && (
          <h2 className="line-clamp-2 text-lg leading-snug font-semibold">{item.title}</h2>
        )}
        {item.text && (
          <p
            className={cn(
              'break-words whitespace-pre-line',
              hasMedia ? 'line-clamp-4 text-sm' : 'text-lg leading-relaxed',
            )}
          >
            {item.text}
          </p>
        )}
        <p className="truncate text-sm text-muted-foreground">
          {[item.author, item.info].filter(Boolean).join(' · ')}
        </p>
      </div>
      {top && (
        <>
          <Stamp
            label="Remove"
            opacity={remove}
            className="right-6 rotate-12 border-destructive text-destructive"
          />
          <Stamp
            label="Keep"
            opacity={keep}
            className="left-6 -rotate-12 border-success text-success"
          />
          <Stamp
            label="Open"
            opacity={open}
            className="left-1/2 -translate-x-1/2 border-open text-open"
          />
        </>
      )}
    </motion.article>
  );
}
