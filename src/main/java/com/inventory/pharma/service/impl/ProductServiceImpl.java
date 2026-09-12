package com.inventory.pharma.service.impl;

import com.inventory.pharma.config.util.ValidationUtils;
import com.inventory.pharma.dto.ProductImportItemDTO;
import com.inventory.pharma.dto.ProductImportResultDTO;
import com.inventory.pharma.model.Batch;
import com.inventory.pharma.model.Product;
import com.inventory.pharma.model.StockMovement;
import com.inventory.pharma.model.enumerate.BatchStatus;
import com.inventory.pharma.model.enumerate.MovementType;
import com.inventory.pharma.repository.BatchRepository;
import com.inventory.pharma.repository.ProductRepository;
import com.inventory.pharma.service.IProductService;
import com.inventory.pharma.service.IStockMovementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ProductServiceImpl implements IProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private BatchRepository batchRepository;

    @Autowired
    private IStockMovementService stockMovementService;

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

    @Override
    @Transactional
    public ProductImportResultDTO importProducts(List<ProductImportItemDTO> items) {
        ProductImportResultDTO result = new ProductImportResultDTO();
        if (items == null || items.isEmpty()) {
            result.addMessage("Aucun élément à importer");
            return result;
        }

        // Cache des produits existants avec clé en minuscules sans espaces superflus
        Map<String, Product> productMap = new HashMap<>();
        for (Product p : productRepository.findAll()) {
            if (p.getItem() != null && !p.getItem().isBlank()) {
                productMap.put(p.getItem().trim().toLowerCase(), p);
            }
        }

        int totalProcessed = 0;
        int productsCreated = 0;
        int productsUpdated = 0;
        int batchesCreated = 0;
        int movementsCreated = 0;

        for (ProductImportItemDTO itemDto : items) {
            if (itemDto.getName() == null || itemDto.getName().trim().isBlank()) {
                continue;
            }

            String rawName = itemDto.getName().trim();
            String lookupKey = rawName.toLowerCase();

            Long quantity = itemDto.getQuantity() != null ? Math.max(0L, itemDto.getQuantity()) : 0L;
            Double unitPrice = itemDto.getUnitPrice() != null ? Math.max(0.0, itemDto.getUnitPrice()) : 0.0;
            String category = itemDto.getCategory() != null && !itemDto.getCategory().trim().isBlank()
                    ? itemDto.getCategory().trim()
                    : "Pharmaceutique";

            Product product = productMap.get(lookupKey);

            if (product == null) {
                // Créer le nouveau produit
                product = new Product();
                product.setItem(rawName);
                product.setDesignation(category);
                product.setQuantity(0L);
                product.setUnitPrice(unitPrice);
                product = productRepository.save(product);

                productMap.put(lookupKey, product);
                productsCreated++;
            } else {
                // Produit existant : mettre à jour le prix si existant est nul ou zéro et nouvel item a un prix
                if ((product.getUnitPrice() == null || product.getUnitPrice() == 0.0) && unitPrice > 0.0) {
                    product.setUnitPrice(unitPrice);
                    product = productRepository.save(product);
                    productMap.put(lookupKey, product);
                }
                productsUpdated++;
            }

            // Créer le lot associé avec date d'expiration null (considéré non périmé)
            Batch batch = new Batch();
            batch.setProduct(product);
            batch.setBatch_quantity(quantity);
            batch.setExpiryDate(null);
            batch.setStatus(BatchStatus.ACTIVE);
            batch.setArchived(false);

            Batch savedBatch = batchRepository.save(batch);
            batchesCreated++;

            // Créer le mouvement de stock initial approprié si quantité > 0
            if (quantity > 0L) {
                StockMovement stockMovement = new StockMovement(
                        MovementType.IN,
                        quantity,
                        "Importation inventaire - Réception stock",
                        LocalDateTime.now(),
                        savedBatch
                );
                stockMovementService.createInitialStockMovement(stockMovement);
                movementsCreated++;

                // Mettre à jour l'instance produit en mémoire avec sa nouvelle quantité totale
                product.setQuantity(product.getQuantity() + quantity);
                productMap.put(lookupKey, product);
            }

            totalProcessed++;
        }

        result.setTotalProcessed(totalProcessed);
        result.setProductsCreated(productsCreated);
        result.setProductsUpdated(productsUpdated);
        result.setBatchesCreated(batchesCreated);
        result.setMovementsCreated(movementsCreated);
        result.addMessage("Importation terminée avec succès : " + totalProcessed + " lignes traitées.");

        return result;
    }
}
