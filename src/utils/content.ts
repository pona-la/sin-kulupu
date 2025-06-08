import { getCollection } from "astro:content";

// utilities

export const by =
  <T>(key: (x: T) => number, ascending: boolean = true) =>
  (a: T, b: T) =>
    (ascending ? 1 : -1) * (key(a) - key(b));

// posts, sorted from newest to oldest.

export const posts = (await getCollection("blog")).sort(
  by((x) => x.data.date.valueOf(), false),
);

export const prevnexts = Object.fromEntries(
  posts
    .reverse()
    .map((post, i) => [post.id, { prev: posts[i - 1], next: posts[i + 1] }]),
);
