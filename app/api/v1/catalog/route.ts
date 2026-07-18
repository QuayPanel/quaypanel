import { withApi, jsonOk } from "@/src/core/api";
import { listCategories, getCategoryBySlug } from "@/src/domains/categories/service";
import {
  getProductBySlug,
  listFeaturedProducts,
  listProducts,
} from "@/src/domains/products/service";

export async function GET(request: Request) {
  return withApi(request, async ({ request: req }) => {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const slug = url.searchParams.get("slug");

    if (type === "categories") {
      return jsonOk(await listCategories(true));
    }
    if (type === "category" && slug) {
      return jsonOk(await getCategoryBySlug(slug));
    }
    if (type === "product" && slug) {
      return jsonOk(await getProductBySlug(slug));
    }
    if (type === "featured") {
      return jsonOk(await listFeaturedProducts());
    }
    return jsonOk(await listProducts(true));
  });
}
