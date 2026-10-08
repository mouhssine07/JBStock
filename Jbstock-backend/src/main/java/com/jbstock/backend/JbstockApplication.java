package com.jbstock.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class JbstockApplication {

    public static void main(String[] args) {
        try {
            SpringApplication.run(JbstockApplication.class, args);
        } catch (RuntimeException failure) {
            // ApplicationFailedEvent reports a safe code. Do not let the JVM print raw causes.
            System.exit(1);
        }
    }

}
