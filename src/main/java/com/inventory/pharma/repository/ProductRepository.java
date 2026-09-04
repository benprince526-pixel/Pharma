package com.inventory.pharma.repository;

import com.inventory.pharma.model.Product;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    @Query("select distinct p from Product p join p.batches b where b.batch_id = :batchId")
    List<Product> findByBatchBatchId(@Param("batchId") Long batchId);
    List<Product> findByItem(String item);
    List<Product> findByDesignation(String designation);
}
