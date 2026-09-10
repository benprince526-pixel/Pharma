package com.inventory.pharma.service.impl;

import com.inventory.pharma.config.util.ValidationUtils;
import com.inventory.pharma.model.Batch;
import com.inventory.pharma.model.Product;
import com.inventory.pharma.repository.BatchRepository;
import com.inventory.pharma.repository.ProductRepository;
import com.inventory.pharma.service.IProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ProductServiceImpl implements IProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private BatchRepository batchRepository;

    public void verifyProductProperties(Product product) {

        if (product == null) {
            throw new IllegalArgumentException("Product cannot be null");
        }

        if (ValidationUtils.isBlank(product.getItem())) {
            throw new IllegalArgumentException("Item is required");
        }

        if (ValidationUtils.isBlank(product.getDesignation())) {
            throw new IllegalArgumentException("Designation is required");
        }

        if (product.getUnitPrice() == null || product.getUnitPrice() < 0) {
            throw new IllegalArgumentException("Unit price must be greater than or equal to 0");
        }


        if(product.getUnitPrice() > 1_000_000L){
            throw new IllegalArgumentException("Unit price too high");
        }

        if (product.getQuantity() == null || product.getQuantity() < 0) {
            throw new IllegalArgumentException("Quantity must be greater than or equal to 0");
        }

        if(product.getQuantity() > 1_000_000L){
            throw new IllegalArgumentException("Quantity too high");
        }
    }

    public void verifyProductUpdate(Product product) {

        if (product.getProduct_id() == null) {
            throw new IllegalArgumentException("Product ID is required for update");
        }

        verifyProductProperties(product);
    }


    public Long calculateTotalProductQuantity(Long productId) {
        List<Batch> activeBatches = batchRepository.findByProductProduct_idAndArchivedFalse(productId);
        return activeBatches.stream()
                .mapToLong(Batch::getBatch_quantity)
                .sum();
    }

    public Product createProduct(Product product) {
        verifyProductProperties(product);
        return productRepository.save(product);
    }

    public Optional<Product> getProductById(Long productId) {
        return productRepository.findById(productId);
    }

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    public List<Product> getProductsByItem(String item) {
        return productRepository.findByItem(item);
    }

    public List<Product> getProductsByDesignation(String designation) {
        return productRepository.findByDesignation(designation);
    }

    public Product updateProduct(Product productDetails) {
        verifyProductUpdate(productDetails);
        Optional<Product> product = productRepository.findById(productDetails.getProduct_id());
        if (product.isPresent()) {
            Product existingProduct = product.get();
            if (productDetails.getItem() != null) {
                existingProduct.setItem(productDetails.getItem());
            }
            if (productDetails.getDesignation() != null) {
                existingProduct.setDesignation(productDetails.getDesignation());
            }
            if (productDetails.getQuantity() != null) {
                existingProduct.setQuantity(productDetails.getQuantity());
            }
            if (productDetails.getUnitPrice() != null) {
                existingProduct.setUnitPrice(productDetails.getUnitPrice());
            }
            return productRepository.save(existingProduct);
        }
        return null;
    }

    public boolean deleteProduct(Long productId) {
        if (productRepository.existsById(productId)) {
            productRepository.deleteById(productId);
            return true;
        }
        return false;
    }
}
