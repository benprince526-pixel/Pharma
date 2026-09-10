package com.inventory.pharma.service.impl;

import com.inventory.pharma.config.util.ValidationUtils;
import com.inventory.pharma.model.Batch;
import com.inventory.pharma.model.Product;
import com.inventory.pharma.model.StockMovement;
import com.inventory.pharma.model.enumerate.MovementType;
import com.inventory.pharma.repository.BatchRepository;
import com.inventory.pharma.repository.ProductRepository;
import com.inventory.pharma.repository.StockMovementRepository;
import com.inventory.pharma.service.IStockMovementService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;


@Service
public class StockMovementServiceImpl implements IStockMovementService {

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Autowired
    private BatchRepository batchRepository;

    @Autowired
    private ProductRepository productRepository;

    public void verifyStockMovementProperties(StockMovement movement) {

        if (movement == null) {
            throw new IllegalArgumentException("Movement cannot be null");
        }

        if (movement.getBatch() == null) {
            throw new IllegalArgumentException("Batch is required");
        }

        if (movement.getMovement_type() == null) {
            throw new IllegalArgumentException("Movement type is required");
        }

        if (movement.getQuantity() == null || movement.getQuantity() <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than 0");
        }

        if(movement.getQuantity() > 1_000_000L){
            throw new IllegalArgumentException("Quantity too high");
        }

        if (ValidationUtils.isBlank(movement.getReason())) {
            throw new IllegalArgumentException("Reason is required");
        }

        if (movement.getMovement_type() == MovementType.OUT
                && movement.getQuantity() > movement.getBatch().getBatch_quantity()) {

            throw new IllegalArgumentException(
                    "Insufficient stock in the batch");
        }
    }

    public void verifyStockMovementUpdate(StockMovement stockMovement) {

        if (stockMovement.getBatch() == null) {
            throw new IllegalArgumentException("Product ID is required for update");
        }

        verifyStockMovementProperties(stockMovement);
    }

    @Override
    @Transactional
    public StockMovement createStockMovement(StockMovement movement) {
        if (movement.getBatch() == null || movement.getBatch().getBatch_id() == null) {
            throw new IllegalArgumentException("Batch ID must not be null when creating a stock movement");
        }

        Long batchId = movement.getBatch().getBatch_id();
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new EntityNotFoundException("Batch not found with ID: " + batchId));
        if(batch.isArchived()){
            throw new IllegalArgumentException("Batch archived, can't do stock movement");
        }
        Product product = batch.getProduct();
        if (product == null) {
            throw new IllegalStateException("Associated product for batch ID " + batchId + " is null");
        }

        long qty = movement.getQuantity();

        if (movement.getMovement_type() == MovementType.IN) {
            // Add quantity to Batch and Product
            batch.setBatch_quantity(batch.getBatch_quantity() + qty);
            product.setQuantity(product.getQuantity() + qty);
        } else if (movement.getMovement_type() == MovementType.OUT) {
            // Validate availability before deduction
            if (qty > batch.getBatch_quantity()) {
                throw new IllegalStateException("Insufficient stock in Batch #" + batchId
                        + ". Requested: " + qty + ", Available: " + batch.getBatch_quantity());
            }
            batch.setBatch_quantity(batch.getBatch_quantity() - qty);
            product.setQuantity(product.getQuantity() - qty);
        }

        // Save updated parent quantities
        batchRepository.save(batch);
        productRepository.save(product);

        movement.setBatch(batch);
        movement.setCreatedAt(LocalDateTime.now());
        return stockMovementRepository.save(movement);
    }
    @Transactional
    public StockMovement createInitialStockMovement(StockMovement movement) {

        verifyStockMovementProperties(movement);
        if (movement.getBatch() == null || movement.getBatch().getBatch_id() == null) {
            throw new IllegalArgumentException("Batch ID must not be null");
        }

        Batch batch = batchRepository.findById(movement.getBatch().getBatch_id())
                .orElseThrow(() -> new EntityNotFoundException("Batch not found"));
        if(batch.isArchived()){
            throw new IllegalArgumentException("Batch archived, can't do stock movement");
        }
        Product product = batch.getProduct();

        if (product == null) {
            throw new IllegalStateException("Product associated with batch is null");
        }

        // La quantité du lot augmente directement le stock du produit
        product.setQuantity(product.getQuantity() + batch.getBatch_quantity());

        productRepository.save(product);

        movement.setBatch(batch);
        movement.setCreatedAt(LocalDateTime.now());

        return stockMovementRepository.save(movement);
    }

    @Override
    @Transactional
    public StockMovement updateStockMovement(Long id, StockMovement movementDetails) {
        verifyStockMovementUpdate(movementDetails);
        StockMovement existingMovement = stockMovementRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Stock movement not found with ID: " + id));

        if (movementDetails.getBatch() == null || movementDetails.getBatch().getBatch_id() == null) {
            throw new IllegalArgumentException("Batch ID must not be null when updating a stock movement");
        }

        // 2. Fetch target Batch for updated movement
        Long newBatchId = movementDetails.getBatch().getBatch_id();
        Batch newBatch = batchRepository.findById(newBatchId)
                .orElseThrow(() -> new EntityNotFoundException("Batch not found with ID: " + newBatchId));
        if(newBatch.isArchived()){
            throw new IllegalArgumentException("Batch archived, can't do stock movement");
        }

        // 1. Revert previous movement effect from old Batch & Product
        Batch oldBatch = existingMovement.getBatch();
        Product oldProduct = oldBatch.getProduct();
        long oldQty = existingMovement.getQuantity();

        if (existingMovement.getMovement_type() == MovementType.IN) {
            oldBatch.setBatch_quantity(oldBatch.getBatch_quantity() - oldQty);
            oldProduct.setQuantity(oldProduct.getQuantity() - oldQty);
        } else {
            oldBatch.setBatch_quantity(oldBatch.getBatch_quantity() + oldQty);
            oldProduct.setQuantity(oldProduct.getQuantity() + oldQty);
        }
        batchRepository.save(oldBatch);
        productRepository.save(oldProduct);


        Product newProduct = newBatch.getProduct();

        // 3. Apply new movement effect
        long newQty = movementDetails.getQuantity();
        if (movementDetails.getMovement_type() == MovementType.IN) {
            newBatch.setBatch_quantity(newBatch.getBatch_quantity() + newQty);
            newProduct.setQuantity(newProduct.getQuantity() + newQty);
        } else {
            if (newQty > newBatch.getBatch_quantity()) {
                throw new IllegalStateException("Insufficient stock in Batch #" + newBatchId
                        + ". Requested: " + newQty + ", Available: " + newBatch.getBatch_quantity());
            }
            newBatch.setBatch_quantity(newBatch.getBatch_quantity() - newQty);
            newProduct.setQuantity(newProduct.getQuantity() - newQty);
        }

        batchRepository.save(newBatch);
        productRepository.save(newProduct);

        // 4. Update and persist StockMovement entity
        existingMovement.setBatch(newBatch);
        existingMovement.setMovement_type(movementDetails.getMovement_type());
        existingMovement.setQuantity(newQty);
        existingMovement.setReason(movementDetails.getReason());

        return stockMovementRepository.save(existingMovement);
    }

    @Override
    @Transactional
    public boolean deleteStockMovement(Long id) {
        Optional<StockMovement> movementOpt = stockMovementRepository.findById(id);
        if (movementOpt.isPresent()) {
            StockMovement movement = movementOpt.get();
            Batch batch = movement.getBatch();
            if(batch.isArchived()){
                throw new IllegalArgumentException("Batch archived, can't delete stock movement");
            }
            Product product = batch.getProduct();
            long qty = movement.getQuantity();

            // Revert inventory changes when a movement record is deleted
            if (movement.getMovement_type() == MovementType.IN) {
                batch.setBatch_quantity(batch.getBatch_quantity() - qty);
                product.setQuantity(product.getQuantity() - qty);
            } else {
                batch.setBatch_quantity(batch.getBatch_quantity() + qty);
                product.setQuantity(product.getQuantity() + qty);
            }

            batchRepository.save(batch);
            productRepository.save(product);
            stockMovementRepository.deleteById(id);
            return true;
        }
        return false;
    }

    @Override
    public List<StockMovement> getAllStockMovements() {
        return stockMovementRepository.findAll();
    }

    @Override
    public Optional<StockMovement> getStockMovementById(Long id) {
        return stockMovementRepository.findById(id);
    }

    @Override
    public List<StockMovement> getStockMovementsByBatch(Long batchId) {
        return stockMovementRepository.findByBatchBatchId(batchId);
    }
}