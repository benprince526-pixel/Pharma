package com.inventory.pharma.dto;

public class ProductImportItemDTO {
    private String name;
    private String category;
    private Long quantity;
    private Double unitPrice;

    public ProductImportItemDTO() {
    }

    public ProductImportItemDTO(String name, String category, Long quantity, Double unitPrice) {
        this.name = name;
        this.category = category;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Long getQuantity() {
        return quantity;
    }

    public void setQuantity(Long quantity) {
        this.quantity = quantity;
    }

    public Double getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(Double unitPrice) {
        this.unitPrice = unitPrice;
    }
}
