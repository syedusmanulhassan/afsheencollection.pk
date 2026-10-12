import Link from "next/link";
import type { Product } from "@/lib/store";
import { formatPrice } from "@/lib/store";

export function ProductCard({
  product,
  currency,
  onAdd,
}: {
  product: Product;
  currency: string;
  onAdd?: (product: Product) => void;
}) {
  return (
    <article className="product-card">
      <Link className="product-image-link" href={`/products/${product.slug}`}>
        <div
          className={`product-image${product.image_url ? " has-image" : ""}`}
          role={product.image_url ? "img" : undefined}
          aria-label={product.image_url ? product.title : undefined}
          style={
            product.image_url
              ? { backgroundImage: `url("${product.image_url}")` }
              : undefined
          }
        >
          {!product.image_url && <span>Image coming soon</span>}
          {product.stock < 1 && <span className="sold-out">Sold out</span>}
        </div>
      </Link>
      <div className="product-card-body">
        <Link className="product-name" href={`/products/${product.slug}`}>
          {product.title}
        </Link>
        <div className="product-prices">
          <strong>{formatPrice(product.price, currency)}</strong>
          {product.compare_at_price !== null &&
            product.compare_at_price > product.price && (
              <del>{formatPrice(product.compare_at_price, currency)}</del>
            )}
        </div>
        {onAdd && (
          <button
            className="button button-small button-outline"
            type="button"
            disabled={product.stock < 1}
            onClick={() => onAdd(product)}
          >
            {product.stock < 1 ? "Sold out" : "Add to bag"}
          </button>
        )}
      </div>
    </article>
  );
}
