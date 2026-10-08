package com.jbstock.backend.company;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FiscalIdentifierRequest(
        @NotBlank @Size(max = 100) String label,
        @Size(max = 255) String value) {
}
