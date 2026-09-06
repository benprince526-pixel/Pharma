package com.inventory.pharma.repository;

import com.inventory.pharma.model.StockMovement;
import com.inventory.pharma.model.enumerate.MovementType;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {
    @Query("select sm from StockMovement sm where sm.batch.batch_id = :batchId")
    List<StockMovement> findByBatchBatchId(@Param("batchId") Long batchId);
    @Query("select sm from StockMovement sm where sm.movement_type = :movementType")
    List<StockMovement> findByMovementType(@Param("movementType") MovementType movementType);
    List<StockMovement> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT COALESCE(SUM(sm.quantity), 0) FROM StockMovement sm WHERE sm.batch.batch_id = :batchId")
    long sumQuantityByBatchId(@Param("batchId") Long batchId);
}
