package com.jbstock.backend.company;

import java.util.List;

public record CompanyProfile(String name, String address, String phone, String email,
                             List<FiscalIdentifier> fiscalIdentifiers) {
}
