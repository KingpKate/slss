package com.slss.repository;

public interface ScanProductionAggregate {
  String getCustomerName();
  String getModel();
  long getTotalCount();
  long getCompletedCount();
  long getUnfinishedCount();
}
