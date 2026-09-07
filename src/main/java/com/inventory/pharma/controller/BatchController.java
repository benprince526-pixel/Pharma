package com.inventory.pharma.controller;

import com.inventory.pharma.model.Batch;
import com.inventory.pharma.model.StockMovement;
import com.inventory.pharma.model.enumerate.MovementType;
import com.inventory.pharma.service.IBatchService;
import com.inventory.pharma.service.IStockMovementService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/batches")
@CrossOrigin(origins = "*")
public class BatchController {

    @Autowired
    private IBatchService batchService;

    @Autowired
    private IStockMovementService stockMovementService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<Batch> createBatch(@Valid @RequestBody Batch batch) {
        Batch createdBatch = batchService.createBatch(batch);
        return new ResponseEntity<>(createdBatch, HttpStatus.CREATED);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<List<Batch>> getAllBatches() {
        List<Batch> batches = batchService.getAllBatches();
        return new ResponseEntity<>(batches, HttpStatus.OK);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<Batch> getBatchById(@PathVariable Long id) {
        Optional<Batch> batch = batchService.getBatchById(id);
        return batch.map(value -> new ResponseEntity<>(value, HttpStatus.OK)).orElseGet(() -> new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }
    @GetMapping("/products/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<List<Batch>> getBatchesByProductId(@PathVariable Long id){
        List<Batch> batches = batchService.getBatchesByProductId(id);
        return new ResponseEntity<>(batches, HttpStatus.OK);
    }

    @GetMapping("/expired")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<List<Batch>> getExpiredBatches(@RequestParam LocalDate date) {
        List<Batch> batches = batchService.getExpiredBatches(date);
        return new ResponseEntity<>(batches, HttpStatus.OK);
    }

    @GetMapping("/upcoming-expiry")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<List<Batch>> getUpcomingExpiredBatches(@RequestParam LocalDate date) {
        List<Batch> batches = batchService.getUpcomingExpiredBatches(date);
        return new ResponseEntity<>(batches, HttpStatus.OK);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<Batch> updateBatch(
            @PathVariable Long id,
            @RequestBody Batch batchDetails) {

        batchDetails.setBatch_id(id);

        Batch updatedBatch = batchService.updateBatch(batchDetails);

        if (updatedBatch != null) {
            return new ResponseEntity<>(updatedBatch, HttpStatus.OK);
        }

        return new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<Void> deleteBatch(@PathVariable Long id) {
        if (batchService.deleteBatch(id)) {
            return new ResponseEntity<>(HttpStatus.NO_CONTENT);
        }
        return new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }

    @PostMapping("/clear-expired/{batchId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<StockMovement> clearExpiredBatch(@PathVariable Long batchId) {
        Batch batch = batchService.getBatchById(batchId)
                .orElseThrow(() -> new EntityNotFoundException("Lot non trouvé : " + batchId));

        if (batch.getBatch_quantity() < 0) {
            return ResponseEntity.badRequest().build();
        }

        StockMovement movement = new StockMovement();
        movement.setMovement_type(MovementType.OUT);
        movement.setQuantity(batch.getBatch_quantity());
        movement.setReason("Retrait - Produit Périmé");
        movement.setBatch(batch);

        StockMovement createdMovement = stockMovementService.createStockMovement(movement);
        batchService.deleteBatch(batch.getBatch_id());
        return ResponseEntity.status(HttpStatus.CREATED).body(createdMovement);
    }

    @PutMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHARMACIST')")
    public ResponseEntity<Batch> archiveBatch(@PathVariable Long id) {

        Batch archivedBatch = batchService.archiveBatch(id);

        return ResponseEntity.ok(archivedBatch);
    }
}
