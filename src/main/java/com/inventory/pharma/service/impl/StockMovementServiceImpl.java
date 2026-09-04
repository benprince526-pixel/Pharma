package com.inventory.pharma.service.impl;

import com.inventory.pharma.model.StockMovement;
import com.inventory.pharma.model.enumerate.MovementType;
import com.inventory.pharma.repository.StockMovementRepository;
import com.inventory.pharma.service.IStockMovementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class StockMovementServiceImpl implements IStockMovementService {

    @Autowired
    private StockMovementRepository stockMovementRepository;

    public StockMovement createStockMovement(StockMovement stockMovement) {
        if (stockMovement.getCreatedAt() == null) {
            stockMovement.setCreatedAt(LocalDateTime.now());
        }
        return stockMovementRepository.save(stockMovement);
    }

    public Optional<StockMovement> getStockMovementById(Long movementId) {
        return stockMovementRepository.findById(movementId);
    }

    public List<StockMovement> getAllStockMovements() {
        return stockMovementRepository.findAll();
    }

    public List<StockMovement> getStockMovementsByBatch(Long batchId) {
        return stockMovementRepository.findByBatchBatchId(batchId);
    }

    public List<StockMovement> getStockMovementsByType(MovementType movementType) {
        return stockMovementRepository.findByMovementType(movementType);
    }

    public List<StockMovement> getStockMovementsByDateRange(LocalDateTime start, LocalDateTime end) {
        return stockMovementRepository.findByCreatedAtBetween(start, end);
    }

    public StockMovement updateStockMovement(Long movementId, StockMovement movementDetails) {
        Optional<StockMovement> movement = stockMovementRepository.findById(movementId);
        if (movement.isPresent()) {
            StockMovement existingMovement = movement.get();
            existingMovement.setMovement_type(movementDetails.getMovement_type());
            existingMovement.setQuantity(movementDetails.getQuantity());
            existingMovement.setReason(movementDetails.getReason());
            return stockMovementRepository.save(existingMovement);
        }
        return null;
    }

    public boolean deleteStockMovement(Long movementId) {
        if (stockMovementRepository.existsById(movementId)) {
            stockMovementRepository.deleteById(movementId);
            return true;
        }
        return false;
    }
}
