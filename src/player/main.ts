// YouTube refuses to embed its player inside youtube.com itself, so cards on the
// Watch Later page frame this extension page, which embeds the player instead.
const id = new URLSearchParams(location.search).get('v') ?? '';
if (/^[\w-]{11}$/.test(id)) {
  const player = document.createElement('iframe');
  player.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
  player.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
  player.allowFullscreen = true;
  player.referrerPolicy = 'strict-origin-when-cross-origin';
  document.body.append(player);
}
