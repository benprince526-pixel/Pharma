package com.inventory.pharma.config.util;

public class ValidationUtils {

    public static boolean isAlphanumeric(String str) {
        return str != null
                && !Character.isDigit(str.charAt(0));
    }

    public static boolean isBlank(String str) {
        return str == null || str.trim().isEmpty();
    }
}