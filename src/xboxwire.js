// Xbox Wire: catch Game Pass announcements made months before a game shows up in
// Microsoft's "Coming to Game Pass" feed. This is a heuristic — a mention in a
// Game Pass post is a strong hint, not a guarantee.

import { normalize } from './match.js';

const FEEDS = [
  'https://news.xbox.com/en-us/xbox-game-pass/feed/',
  'https://news.xbox.com/en-us/tag/xbox-game-pass/feed/',
];

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/g, ' ');

export async function getGamePassPosts() {
  const posts = new Map();
  for (const feed of FEEDS) {
    const res = await fetch(feed);
    if (!res.ok) continue; // best effort; the official feeds above are the source of truth
    const xml = await res.text();
    for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const get = (tag) => item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? '';
      const link = get('link').trim();
      if (posts.has(link)) continue;
      const html = get('content:encoded') || get('description');
      posts.set(link, {
        title: decode(get('title')).trim(),
        link,
        date: new Date(get('pubDate')).toISOString().slice(0, 10),
        text: ' ' + normalize(decode(html.replace(/<[^>]+>/g, ' '))) + ' ',
      });
    }
  }
  // Many posts mention Game Pass in passing (e.g. Free Play Days), so require a title
  // about Game Pass or announcement wording in the body.
  const announces = / (coming (soon )?to|day one (with|on|in)|launch(es|ing)? (in|into|with|on)) (xbox |pc )?game pass /;
  return [...posts.values()].filter(
    (p) => (/game pass/i.test(p.title) && !/free play days/i.test(p.title)) || announces.test(p.text)
  );
}

// Returns [{ title, link, date }] for posts that mention this game by name.
export function findMentions(posts, steamName) {
  const key = normalize(steamName);
  if (key.length < 5) return []; // too short to search for safely
  return posts.filter((p) => p.text.includes(` ${key} `)).map(({ title, link, date }) => ({ title, link, date }));
}
