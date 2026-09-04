package com.inventory.pharma.service.impl;

import com.inventory.pharma.model.Batch;
import com.inventory.pharma.model.Product;
import com.inventory.pharma.repository.BatchRepository;
import com.inventory.pharma.repository.ProductRepository;
import com.inventory.pharma.service.IBatchService;
import jakarta.persistence.EntityExistsException;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class BatchServiceImpl implements IBatchService {

    @Autowired
    private BatchRepository batchRepository;

    @Autowired
    private ProductRepository productRepository;

    @Override
    @Transactional
    public Batch createBatch(Batch batch) {
        if (batch.getProduct() == null || batch.getProduct().getProduct_id() == null) {
            throw new IllegalArgumentException("Product ID must not be null when creating a batch");
        }

        Long productId = batch.getProduct().getProduct_id();

        // Fetch product from DB
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new EntityNotFoundException("Product not found with ID: " + productId));

        // Efficient database-side sum
        long currentTotalQuantity = batchRepository.sumQuantityByProductId(productId);
        long projectedTotalQuantity = currentTotalQuantity + batch.getBatch_quantity();

        if (projectedTotalQuantity > product.getQuantity()) {
            throw new IllegalStateException("The total batch quantity (" + projectedTotalQuantity
                    + ") exceeds the total available product stock (" + product.getQuantity() + ")");
        }

        batch.setProduct(product);
        return batchRepository.save(batch);
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

    public Batch updateBatch( Batch batchDetails) {
        Optional<Batch> batch = batchRepository.findById(batchDetails.getBatch_id());
        if (batch.isPresent()) {
            Batch existingBatch = batch.get();
            if (batchDetails.getExpiryDate() != null) {
                existingBatch.setExpiryDate(batchDetails.getExpiryDate());
            }
            return batchRepository.save(existingBatch);
        }
        return null;
    }

    public boolean deleteBatch(Long batchId) {
        if (batchRepository.existsById(batchId)) {
            batchRepository.deleteById(batchId);
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
}
