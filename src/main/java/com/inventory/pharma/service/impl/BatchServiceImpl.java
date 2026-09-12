package com.inventory.pharma.service.impl;

import com.inventory.pharma.model.Batch;
import com.inventory.pharma.model.Product;
import com.inventory.pharma.model.StockMovement;
import com.inventory.pharma.model.enumerate.MovementType;
import com.inventory.pharma.repository.BatchRepository;
import com.inventory.pharma.repository.ProductRepository;
import com.inventory.pharma.repository.StockMovementRepository;
import com.inventory.pharma.service.IBatchService;
import com.inventory.pharma.service.IStockMovementService;
import jakarta.persistence.EntityExistsException;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class BatchServiceImpl implements IBatchService {

    @Autowired
    private BatchRepository batchRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private IStockMovementService stockMovementService;

    public void verifyBatchProperties(Batch batch) {

        if (batch == null) {
            throw new IllegalArgumentException("Batch cannot be null");
        }

        if (batch.getProduct() == null) {
            throw new IllegalArgumentException("A product must be associated with the batch");
        }

        if (batch.getBatch_quantity() == null || batch.getBatch_quantity() < 0) {
            throw new IllegalArgumentException("Batch quantity must be greater than or equal to 0");
        }

        if(batch.getBatch_quantity() > 1_000_000L){
            throw new IllegalArgumentException("Quantity too high");
        }
    }

    public void verifyBatchUpdate(Batch batch) {

        if (batch.getBatch_id() == null) {
            throw new IllegalArgumentException("Product ID is required for update");
        }

        verifyBatchProperties(batch);
    }


    @Override
    @Transactional
    public Batch createBatch(Batch batch) {
        verifyBatchProperties(batch);
        if (batch.getProduct() == null || batch.getProduct().getProduct_id() == null) {
            throw new IllegalArgumentException("Product ID must not be null when creating a batch");
        }

        Long productId = batch.getProduct().getProduct_id();

        Product product = productRepository.findById(productId)
                .orElseThrow(() ->
                        new EntityNotFoundException("Product not found with ID: " + productId)
                );

        batch.setProduct(product);

        Batch savedBatch = batchRepository.save(batch);

        if (savedBatch.getBatch_quantity() > 0) {
            StockMovement stockMovement = new StockMovement(
                    MovementType.IN,
                    savedBatch.getBatch_quantity(),
                    "Réception stock",
                    LocalDateTime.now(),
                    savedBatch
            );

            stockMovementService.createInitialStockMovement(stockMovement);
        }

        return savedBatch;
    }

    public Optional<Batch> getBatchById(Long batchId) {
        return batchRepository.findById(batchId);
    }

    public List<Batch> getAllBatches() {
        return batchRepository.findAll();
    }

    public List<Batch> getExpiredBatches(LocalDate date) {
        return batchRepository.findByExpiryDateBefore(date);
    }

    public List<Batch> getUpcomingExpiredBatches(LocalDate date) {
        return batchRepository.findByExpiryDateAfter(date);
    }
    @Transactional
    public Batch updateBatch(Batch batchDetails) {

        verifyBatchUpdate(batchDetails);

        Optional<Batch> batchOptional =
                batchRepository.findById(batchDetails.getBatch_id());

        if (batchOptional.isPresent()) {

            Batch existingBatch = batchOptional.get();

            // Modifier la date d'expiration
            if (batchDetails.getExpiryDate() != null) {
                existingBatch.setExpiryDate(batchDetails.getExpiryDate());
            }

            // Modifier la quantité
            if (batchDetails.getBatch_quantity() != null) {

                long oldQuantity = existingBatch.getBatch_quantity();
                long newQuantity = batchDetails.getBatch_quantity();

                long difference = newQuantity - oldQuantity;

                Product product = existingBatch.getProduct();

                if (product == null) {
                    throw new IllegalStateException("Product associated with batch is null");
                }

                // Mettre à jour le stock du produit
                product.setQuantity(product.getQuantity() + difference);

                productRepository.save(product);

                // Mettre à jour le stock du lot
                existingBatch.setBatch_quantity(newQuantity);
            }

            return batchRepository.save(existingBatch);
        }

        return null;
    }
    @Override
    @Transactional
    public boolean deleteBatch(Long batchId) {

        Optional<Batch> batchOptional = batchRepository.findById(batchId);

        if (batchOptional.isPresent()) {

            Batch batch = batchOptional.get();
            Product product = batch.getProduct();

            if (product == null) {
                throw new IllegalStateException(
                        "Product associated with batch is null"
                );
            }

            // Retirer la quantité du lot du stock du produit
            product.setQuantity(
                    product.getQuantity() - batch.getBatch_quantity()
            );

            productRepository.save(product);

            // Supprimer le lot
            batchRepository.delete(batch);

            return true;
        }

        return false;
    }
    @Override
    public List<Batch> getBatchesByProductId(Long id) {
        if(productRepository.existsById(id)){
            return batchRepository.findAllByProductId(id);
        }
        return null;
    }

    @Override
    @Transactional
    public Batch archiveBatch(Long id) {

        Batch batch = batchRepository.findById(id)
                .orElseThrow(() ->
                        new EntityNotFoundException("Lot non trouvé : " + id)
                );

        // Si le lot est déjà archivé, ne pas créer un deuxième mouvement OUT
        if (batch.isArchived()) {
            return batch;
        }

        long quantity = batch.getBatch_quantity();

        // Créer le mouvement OUT avant de mettre le lot à zéro
        if (quantity > 0) {

            StockMovement stockMovement = new StockMovement(
                    MovementType.OUT,
                    quantity,
                    "Archivage du lot",
                    LocalDateTime.now(),
                    batch
            );

            stockMovementService.createStockMovement(stockMovement);
        }

        // Le lot est ensuite marqué comme archivé
        batch.setArchived(true);
        batch.setBatch_quantity(quantity);
        Product product = productRepository.findById(batch.getProduct().getProduct_id())
                .orElseThrow(()->new RuntimeException("Product associated not found"));
        //product.setQuantity(product.getQuantity() - batch.getBatch_quantity());
        productRepository.save(product);
        return batchRepository.save(batch);
    }
}
