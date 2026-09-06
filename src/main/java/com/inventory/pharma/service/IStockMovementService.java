package com.inventory.pharma.service;

import com.inventory.pharma.model.StockMovement;
import com.inventory.pharma.model.enumerate.MovementType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface IStockMovementService {
    StockMovement createStockMovement(StockMovement stockMovement);
    StockMovement createInitialStockMovement(StockMovement stockMovement);
    Optional<StockMovement> getStockMovementById(Long movementId);
    List<StockMovement> getAllStockMovements();
    List<StockMovement> getStockMovementsByBatch(Long batchId);
    StockMovement updateStockMovement(Long movementId, StockMovement movementDetails);
    boolean deleteStockMovement(Long movementId);
}
