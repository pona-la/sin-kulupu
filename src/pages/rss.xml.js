import rss from "@astrojs/rss";
import { SITE_TITLE, SITE_DESCRIPTION } from "@/consts";
import { feed } from "@/utils/content";

export async function GET(context) {
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: feed.map((post) => ({
      ...post.data,
      link: `${import.meta.env.BASE_URL}/${post.id}/`,
      content: post.rendered.html,
      pubDate: post.data.date,
    })),
  });
}
