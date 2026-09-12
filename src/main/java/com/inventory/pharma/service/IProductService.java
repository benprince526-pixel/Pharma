package com.inventory.pharma.service;

import com.inventory.pharma.dto.ProductImportItemDTO;
import com.inventory.pharma.dto.ProductImportResultDTO;
import com.inventory.pharma.model.Product;

import java.util.List;
import java.util.Optional;

public interface IProductService {
    Product createProduct(Product product);
    Optional<Product> getProductById(Long productId);
    List<Product> getAllProducts();
    List<Product> getProductsByItem(String item);
    List<Product> getProductsByDesignation(String designation);
    Product updateProduct(Product productDetails);
    boolean deleteProduct(Long productId);
    Long calculateTotalProductQuantity(Long productId);
    ProductImportResultDTO importProducts(List<ProductImportItemDTO> items);
}
