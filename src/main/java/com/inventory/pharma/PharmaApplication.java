package com.inventory.pharma;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;


@SpringBootApplication
public class PharmaApplication {

	public static void main(String[] args) {
		SpringApplication.run(PharmaApplication.class, args);
	}

}
