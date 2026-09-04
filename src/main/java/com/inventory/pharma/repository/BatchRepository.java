package com.inventory.pharma.repository;

import com.inventory.pharma.model.Batch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface BatchRepository extends JpaRepository<Batch, Long> {
    List<Batch> findByExpiryDateBefore(LocalDate date);
    List<Batch> findByExpiryDateAfter(LocalDate date);

    List<Batch> findAllByProductId(Long id);

    Optional<Batch> findByExpiryDate(LocalDate expiryDate);

    @Query("SELECT COALESCE(SUM(b.batch_quantity), 0) FROM Batch b WHERE b.product.id = :productId")
    long sumQuantityByProductId(@Param("productId") Long productId);
}
