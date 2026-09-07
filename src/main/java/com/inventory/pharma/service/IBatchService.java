package com.inventory.pharma.service;

import com.inventory.pharma.model.Batch;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface IBatchService {
    Batch createBatch(Batch batch);
    Optional<Batch> getBatchById(Long batchId);
    List<Batch> getAllBatches();
    List<Batch> getExpiredBatches(LocalDate date);
    List<Batch> getUpcomingExpiredBatches(LocalDate date);
    Batch updateBatch(Batch batchDetails);
    boolean deleteBatch(Long batchId);
    Batch archiveBatch(Long id);
    List<Batch> getBatchesByProductId(Long id);
}
