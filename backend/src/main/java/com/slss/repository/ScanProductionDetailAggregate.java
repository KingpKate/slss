package com.slss.repository;

/**
 * Read-model projection used by dashboard drill-downs.  The dashboard only
 * needs customer/model/count rows, so it must not hydrate ScanTable, rows or
 * values just to render a grouped detail table.
 */
public interface ScanProductionDetailAggregate {
    String getCustomerName();
    String getModel();
    Long getQuantity();
}
