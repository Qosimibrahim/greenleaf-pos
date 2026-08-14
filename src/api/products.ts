import { api } from "./client";
import { Product, ProductCategory, ProductImage, ProductDocument } from "../types";

export const productsApi = {
  getAll: (sku?: string) =>
    api.get<Product[] | Product>(sku ? `/products?sku=${encodeURIComponent(sku)}` : "/products"),

  create: (data: Partial<Product>) =>
    api.post<Product>("/products", data),

  update: (id: string, data: Partial<Product>) =>
    api.put<Product>(`/products/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/products/${id}`),

  bulkImport: (products: any[]) =>
    api.post<{ createdCount: number; updatedCount: number }>("/products/bulk", { products }),

  getCategories: () =>
    api.get<ProductCategory[]>("/product_categories"),

  createCategory: (name: string) =>
    api.post<ProductCategory>("/product_categories", { name }),

  getImages: (productId: string) =>
    api.get<ProductImage[]>(`/product_images?product_id=${productId}`),

  createImage: (data: Partial<ProductImage>) =>
    api.post<ProductImage>("/product_images", data),

  deleteImage: (id: string) =>
    api.delete<{ success: boolean }>(`/product_images?id=${id}`),

  getDocuments: (productId: string) =>
    api.get<ProductDocument[]>(`/product_documents?product_id=${productId}`),

  createDocument: (data: Partial<ProductDocument>) =>
    api.post<ProductDocument>("/product_documents", data),

  deleteDocument: (id: string) =>
    api.delete<{ success: boolean }>(`/product_documents?id=${id}`),

  uploadFile: (file: File) =>
    api.upload("/storage/upload", file),
};
