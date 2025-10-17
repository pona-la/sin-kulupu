import { feed } from "@/lib/content";
import { rss } from "selo-components/rss";

export const GET = async (context: any) => rss(feed)(context);
