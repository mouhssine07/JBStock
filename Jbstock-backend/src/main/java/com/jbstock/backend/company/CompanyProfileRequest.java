package com.jbstock.backend.company;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CompanyProfileRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 2000) String address,
        @Size(max = 50) String phone,
        @Email @Size(max = 254) String email,
        @NotNull @Size(max = 20) List<@NotNull @Valid FiscalIdentifierRequest> fiscalIdentifiers) {
}
