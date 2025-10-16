import { getCollection } from "astro:content";

// utilities

export const by =
  <T>(key: (x: T) => number, ascending: boolean = true) =>
  (a: T, b: T) =>
    (ascending ? 1 : -1) * (key(a) - key(b));

// posts, sorted from newest to oldest.

export const posts = await getCollection("content");
export const feed = posts
  .filter((x) => x.data.date)
  .sort(by((x) => x.data.date!.valueOf(), false));

export const prevnexts = Object.fromEntries(
  feed
    .toReversed()
    .map((post, i) => [
      post.id,
      { prev: feed.toReversed()[i - 1], next: feed.toReversed()[i + 1] },
    ]),
);
