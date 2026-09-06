package com.inventory.pharma.controller;

import com.inventory.pharma.model.StockMovement;
import com.inventory.pharma.model.enumerate.MovementType;
import com.inventory.pharma.service.IStockMovementService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
@RestController
@RequestMapping("/api/stock-movements")
@CrossOrigin(origins = "*")
public class StockMovementController {

    @Autowired
    private IStockMovementService stockMovementService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<StockMovement> createStockMovement(@Valid @RequestBody StockMovement movement) {
        StockMovement createdMovement = stockMovementService.createStockMovement(movement);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdMovement);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<List<StockMovement>> getAllStockMovements() {
        List<StockMovement> movements = stockMovementService.getAllStockMovements();
        return new ResponseEntity<>(movements, HttpStatus.OK);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<StockMovement> getStockMovementById(@PathVariable Long id) {
        Optional<StockMovement> movement = stockMovementService.getStockMovementById(id);
        return movement.map(value -> new ResponseEntity<>(value, HttpStatus.OK))
                .orElseGet(() -> new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }

    @GetMapping("/batch/{batchId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<List<StockMovement>> getStockMovementsByBatchId(@PathVariable Long batchId) {
        List<StockMovement> movements = stockMovementService.getStockMovementsByBatch(batchId);
        return new ResponseEntity<>(movements, HttpStatus.OK);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<StockMovement> updateStockMovement(@PathVariable Long id, @RequestBody StockMovement movementDetails) {
        StockMovement updated = stockMovementService.updateStockMovement(id, movementDetails);
        return new ResponseEntity<>(updated, HttpStatus.OK);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<Void> deleteStockMovement(@PathVariable Long id) {
        if (stockMovementService.deleteStockMovement(id)) {
            return new ResponseEntity<>(HttpStatus.NO_CONTENT);
        }
        return new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }
}
