package com.inventory.pharma.controller;

import com.inventory.pharma.model.Product;
import com.inventory.pharma.service.IProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "*")
public class ProductController {

    @Autowired
    private IProductService productService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<Product> createProduct(@RequestBody Product product) {
        Product createdProduct = productService.createProduct(product);
        return new ResponseEntity<>(createdProduct, HttpStatus.CREATED);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<List<Product>> getAllProducts() {
        List<Product> products = productService.getAllProducts();
        return new ResponseEntity<>(products, HttpStatus.OK);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<Product> getProductById(@PathVariable Long id) {
        Optional<Product> product = productService.getProductById(id);
        if (product.isPresent()) {
            return new ResponseEntity<>(product.get(), HttpStatus.OK);
        }
        return new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }

    @GetMapping("/search/item")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<List<Product>> getProductsByItem(@RequestParam String item) {
        List<Product> products = productService.getProductsByItem(item);
        return new ResponseEntity<>(products, HttpStatus.OK);
    }

    @GetMapping("/search/designation")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<List<Product>> getProductsByDesignation(@RequestParam String designation) {
        List<Product> products = productService.getProductsByDesignation(designation);
        return new ResponseEntity<>(products, HttpStatus.OK);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<Product> updateProduct(@RequestBody Product productDetails) {
        Product updatedProduct = productService.updateProduct(productDetails);
        if (updatedProduct != null) {
            return new ResponseEntity<>(updatedProduct, HttpStatus.OK);
        }
        return new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        if (productService.deleteProduct(id)) {
            return new ResponseEntity<>(HttpStatus.NO_CONTENT);
        }
        return new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }
}
