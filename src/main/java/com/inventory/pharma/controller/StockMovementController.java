package com.inventory.pharma.controller;

import com.inventory.pharma.model.StockMovement;
import com.inventory.pharma.model.enumerate.MovementType;
import com.inventory.pharma.service.IStockMovementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<StockMovement> createStockMovement(@RequestBody StockMovement stockMovement) {
        StockMovement createdMovement = stockMovementService.createStockMovement(stockMovement);
        return new ResponseEntity<>(createdMovement, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<StockMovement>> getAllStockMovements() {
        List<StockMovement> movements = stockMovementService.getAllStockMovements();
        return new ResponseEntity<>(movements, HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<StockMovement> getStockMovementById(@PathVariable Long id) {
        Optional<StockMovement> movement = stockMovementService.getStockMovementById(id);
        if (movement.isPresent()) {
            return new ResponseEntity<>(movement.get(), HttpStatus.OK);
        }
        return new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }

    @GetMapping("/batch/{batchId}")
    public ResponseEntity<List<StockMovement>> getStockMovementsByBatch(@PathVariable Long batchId) {
        List<StockMovement> movements = stockMovementService.getStockMovementsByBatch(batchId);
        return new ResponseEntity<>(movements, HttpStatus.OK);
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<List<StockMovement>> getStockMovementsByType(@PathVariable MovementType type) {
        List<StockMovement> movements = stockMovementService.getStockMovementsByType(type);
        return new ResponseEntity<>(movements, HttpStatus.OK);
    }

    @GetMapping("/date-range")
    public ResponseEntity<List<StockMovement>> getStockMovementsByDateRange(
            @RequestParam LocalDateTime start,
            @RequestParam LocalDateTime end) {
        List<StockMovement> movements = stockMovementService.getStockMovementsByDateRange(start, end);
        return new ResponseEntity<>(movements, HttpStatus.OK);
    }

    @PutMapping("/{id}")
    public ResponseEntity<StockMovement> updateStockMovement(@PathVariable Long id, @RequestBody StockMovement movementDetails) {
        StockMovement updatedMovement = stockMovementService.updateStockMovement(id, movementDetails);
        if (updatedMovement != null) {
            return new ResponseEntity<>(updatedMovement, HttpStatus.OK);
        }
        return new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteStockMovement(@PathVariable Long id) {
        if (stockMovementService.deleteStockMovement(id)) {
            return new ResponseEntity<>(HttpStatus.NO_CONTENT);
        }
        return new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }
}
